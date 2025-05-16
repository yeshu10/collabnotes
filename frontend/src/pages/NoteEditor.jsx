import React, { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useDispatch, useSelector } from 'react-redux';
import { notesAPI } from '../services/api';
import { setCurrentNote, updateNote } from '../store/slices/notesSlice';
import { joinNoteRoom, leaveNoteRoom, updateNoteInRealTime } from '../services/socket';
import toast from 'react-hot-toast';
import debounce from 'lodash/debounce';

const NoteEditor = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const dispatch = useDispatch();
  const { currentNote } = useSelector((state) => state.notes);
  const { user } = useSelector((state) => state.auth);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [showShareModal, setShowShareModal] = useState(false);
  const [shareEmail, setShareEmail] = useState('');
  const [sharePermission, setSharePermission] = useState('read');
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState(new Date());
  const [forceEditMode, setForceEditMode] = useState(false);
  const [activeUsers, setActiveUsers] = useState([]);
  const isFirstLoad = useRef(true);
  const autoSaveTimerRef = useRef(null);

  // More reliable user ID comparison function
  const compareIds = useCallback((id1, id2) => {
    if (!id1 || !id2) return false;
    
    // Handle cases where the ID might be an object or already a string
    const str1 = typeof id1 === 'object' ? 
      (id1.toString ? id1.toString() : JSON.stringify(id1)) : 
      String(id1);
    
    const str2 = typeof id2 === 'object' ? 
      (id2.toString ? id2.toString() : JSON.stringify(id2)) : 
      String(id2);
    
    // Strip any quotes that might be present in string representations
    const clean1 = str1.replace(/^"(.+)"$/, '$1');
    const clean2 = str2.replace(/^"(.+)"$/, '$1');
    
    console.log(`Comparing IDs: "${clean1}" vs "${clean2}" => ${clean1 === clean2}`);
    return clean1 === clean2;
  }, []);

  // Improved debounced save function with error handling and retry logic
  const debouncedSave = useCallback(
    debounce(async (noteId, newContent, newTitle) => {
      try {
        if (!noteId) {
          console.error('Missing note ID for save');
          return;
        }
        
        setIsSaving(true);
        console.log('Auto-saving note:', { noteId, newTitle });
        
        // Update in real-time via socket first for instant collaboration
        updateNoteInRealTime(noteId, newContent, newTitle);
        
        // Then save to database (this ensures data is persisted)
        const data = await notesAPI.updateNote(noteId, { 
          title: newTitle, 
          content: newContent 
        });
        
        // Update local state
        dispatch(updateNote(data));
        setLastSaved(new Date());
        console.log('Auto-save completed successfully');
      } catch (error) {
        console.error('Error auto-saving note:', error);
        // Only show toast if it's not a canceled request
        if (!error.message.includes('canceled')) {
          toast.error('Changes will be saved when connection is restored');
          
          // Schedule a retry
          if (autoSaveTimerRef.current) {
            clearTimeout(autoSaveTimerRef.current);
          }
          
          autoSaveTimerRef.current = setTimeout(() => {
            console.log('Retrying auto-save...');
            debouncedSave(noteId, newContent, newTitle);
          }, 5000);
        }
      } finally {
        setIsSaving(false);
      }
    }, 1000),
    []
  );

  // Clean up auto-save timer
  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    console.log('NoteEditor mounting, fetching note with ID:', id);
    fetchNote();
    joinNoteRoom(id);
    
    // Check if share parameter is present in URL
    const searchParams = new URLSearchParams(location.search);
    if (searchParams.get('share') === 'true') {
      setShowShareModal(true);
    }
    
    return () => {
      console.log('NoteEditor unmounting, leaving note room:', id);
      leaveNoteRoom(id);
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, [id, location.search]);

  // Sync note data to local state, but only if it's the first load
  // or if title/content haven't been edited
  useEffect(() => {
    if (currentNote) {
      console.log('Current note updated in Redux:', currentNote._id);
      
      // Only update our local state if:
      // 1. This is the first load
      // 2. We're getting real-time updates from others (not our own edits)
      if (isFirstLoad.current || 
          (title !== currentNote.title || content !== currentNote.content)) {
        
        setTitle(currentNote.title);
        setContent(currentNote.content);
        setLoading(false);
        
        if (isFirstLoad.current) {
          isFirstLoad.current = false;
          console.log('Initial note data loaded');
        } else {
          // Show notification of update
          toast.success('Note was updated by another user');
          console.log('Note was updated remotely');
        }
      }
    }
  }, [currentNote]);

  const fetchNote = async () => {
    try {
      console.log('Fetching note with ID:', id);
      const data = await notesAPI.getNote(id);
      console.log('Received note data:', data);
      
      // Log important values for debugging
      if (data && user) {
        console.log('Permission check IDs:', {
          noteId: id,
          creatorId: data.createdBy?._id,
          userId: user.id, 
          userIdType: typeof user.id,
          user_Id: user._id,
          user_IdType: typeof user._id
        });
      }
      
      dispatch(setCurrentNote(data));
    } catch (error) {
      console.error('Error fetching note:', error);
      toast.error('Error fetching note');
      navigate('/');
    }
  };

  const handleTitleChange = (e) => {
    const newTitle = e.target.value;
    setTitle(newTitle);
    
    // Always trigger save for any change if we have edit permissions
    if (effectiveCanEdit) {
      console.log('Triggering save for title change');
      debouncedSave(id, content, newTitle);
    }
  };

  const handleContentChange = (e) => {
    const newContent = e.target.value;
    setContent(newContent);
    
    // Always trigger save for any change if we have edit permissions
    if (effectiveCanEdit) {
      console.log('Triggering save for content change');
      debouncedSave(id, newContent, title);
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      const data = await notesAPI.updateNote(id, { title, content });
      dispatch(updateNote(data));
      setLastSaved(new Date());
      toast.success('Note saved successfully');
    } catch (error) {
      toast.error('Error saving note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleShare = async (e) => {
    e.preventDefault();
    try {
      const data = await notesAPI.shareNote(id, shareEmail, sharePermission);
      dispatch(updateNote(data));
      setShowShareModal(false);
      setShareEmail('');
      toast.success(`Note shared with ${shareEmail}`);
    } catch (error) {
      toast.error(error.message || 'Error sharing note');
    }
  };

  // IMPROVED permission checking with multiple strategies
  const canEdit = useMemo(() => {
    if (!currentNote || !user) {
      console.log('Cannot check edit permissions - note or user missing');
      return false;
    }

    console.log('Checking permissions with user data:', {
      userId: user.id || user._id,
      userIdType: typeof (user.id || user._id),
      noteCreator: currentNote.createdBy?._id,
      creatorType: typeof currentNote.createdBy?._id,
      collaborators: currentNote.collaborators?.map(c => ({
        id: c.userId?._id,
        permission: c.permission
      }))
    });

    // STRATEGY 1: Backend directly tells us we have permission (most reliable)
    if (currentNote.userPermission && currentNote.userPermission === 'write') {
      console.log('✅ Backend explicitly granted write permission');
      return true;
    }

    // STRATEGY 2: Check if current user is explicitly the owner
    if (currentNote.isOwnedByCurrentUser === true) {
      console.log('✅ Backend flag indicates user is owner');
      return true;
    }

    // STRATEGY 3: Try multiple ID comparison approaches
    // Check creator first
    if (currentNote.createdBy) {
      // Try direct comparison with both user.id and user._id
      if (
        compareIds(user.id, currentNote.createdBy._id) || 
        compareIds(user._id, currentNote.createdBy._id) ||
        compareIds(user.id, currentNote.createdBy.id) || 
        compareIds(user._id, currentNote.createdBy.id)
      ) {
        console.log('✅ User is the creator - granting edit permission');
        return true;
      }
      
      // Try string-based comparison as fallback
      if (
        String(user.id) === String(currentNote.createdBy._id) ||
        String(user._id) === String(currentNote.createdBy._id) ||
        (typeof currentNote.createdBy === 'object' && currentNote.createdBy.id && 
         (String(user.id) === String(currentNote.createdBy.id) ||
          String(user._id) === String(currentNote.createdBy.id)))
      ) {
        console.log('✅ User is the creator (string comparison) - granting edit permission');
        return true;
      }
    }
    
    // STRATEGY 4: Check collaborator permissions
    if (currentNote.collaborators && currentNote.collaborators.length > 0) {
      // Try both object comparison and string comparison
      const hasWriteAccess = currentNote.collaborators.some(collab => {
        if (!collab.userId || collab.permission !== 'write') return false;
        
        // Try various ID formats and comparison methods
        const isMatch = 
          compareIds(user.id, collab.userId._id) || 
          compareIds(user._id, collab.userId._id) ||
          compareIds(user.id, collab.userId.id) || 
          compareIds(user._id, collab.userId.id) ||
          String(user.id) === String(collab.userId._id) ||
          String(user._id) === String(collab.userId._id) ||
          (collab.userId.id && (
            String(user.id) === String(collab.userId.id) ||
            String(user._id) === String(collab.userId.id)
          ));
        
        if (isMatch && collab.permission === 'write') {
          console.log(`✅ Found matching collaborator with ${collab.permission} permission`);
          return true;
        }
        
        return false;
      });
      
      if (hasWriteAccess) {
        console.log('✅ User is a collaborator with write permission');
        return true;
      }
    }
    
    // If we got here, the user doesn't have edit permission
    console.log('❌ No edit permission found after all checks');
    return false;
  }, [currentNote, user, compareIds]);

  // Function to check if user is the creator of the note
  const isCreatorOfNote = useMemo(() => {
    if (!currentNote || !user || !currentNote.createdBy) return false;
    
    return compareIds(user.id, currentNote.createdBy._id) || 
           compareIds(user._id, currentNote.createdBy._id);
  }, [currentNote, user, compareIds]);

  // Determine effective edit permission (either automatic or forced)
  const effectiveCanEdit = canEdit || (isCreatorOfNote && forceEditMode);

  // Debug logging with more details
  console.log('Permission check:', {
    userId: user?.id,
    creatorId: currentNote?.createdBy?._id,
    isCreator: isCreatorOfNote,
    regularCanEdit: canEdit,
    forceEditMode,
    effectiveCanEdit
  });

  // Reload note if we detect a permissions issue for the creator
  useEffect(() => {
    if (isCreatorOfNote && !canEdit && !loading) {
      console.log('Detected permission issue for creator - reloading note');
      fetchNote();
    }
  }, [isCreatorOfNote, canEdit, loading]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4">Loading note...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => navigate('/')}
                className="text-gray-700 hover:text-gray-900"
              >
                Back
              </button>
              <input
                type="text"
                value={title}
                onChange={handleTitleChange}
                disabled={!effectiveCanEdit}
                className="text-xl font-bold text-gray-900 border-none focus:outline-none focus:ring-0"
                placeholder="Note title"
              />
            </div>
            <div className="flex items-center space-x-4">
              {isSaving ? (
                <span className="text-sm text-gray-500">Auto-saving...</span>
              ) : (
                <span className="text-sm text-gray-500">Last saved: {lastSaved.toLocaleTimeString()}</span>
              )}
              {effectiveCanEdit && (
                <button
                  onClick={handleSave}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Save
                </button>
              )}
              {isCreatorOfNote && (
                <button
                  onClick={() => setShowShareModal(true)}
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
                >
                  Share
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {/* Permission issue warning for creator */}
          {!canEdit && isCreatorOfNote && (
            <div className="mb-4 p-3 bg-red-50 border border-red-300 rounded-md text-red-700">
              <p className="font-bold">Permission Issue Detected:</p>
              <p>You should have edit permissions as the note creator but the system is not recognizing your ownership.</p>
              <div className="flex mt-4 space-x-3">
                <button 
                  onClick={() => setForceEditMode(true)}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded"
                >
                  Override and Enable Editing
                </button>
                <button 
                  onClick={fetchNote}
                  className="px-4 py-2 bg-red-100 hover:bg-red-200 text-red-800 rounded"
                >
                  Reload Note Data
                </button>
              </div>
              <pre className="mt-3 p-2 bg-gray-100 rounded text-xs overflow-auto">
                User ID: {user?.id || user?._id}
                <br />
                Note Creator ID: {currentNote?.createdBy?._id}
              </pre>
            </div>
          )}
          
          {/* Read-only mode notification */}
          {!effectiveCanEdit && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md text-yellow-700">
              <p>You are in read-only mode. {isCreatorOfNote ? 'You are the owner of this note but editing is currently disabled.' : 'You do not have edit permissions for this note.'}</p>
            </div>
          )}

          {/* Auto-save status notification */}
          {effectiveCanEdit && (
            <div className="mb-4 p-2 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm">
              <p>Auto-save is enabled. Changes will be saved automatically.</p>
            </div>
          )}
          
          <textarea
            value={content}
            onChange={handleContentChange}
            disabled={!effectiveCanEdit}
            className={`w-full h-[calc(100vh-12rem)] p-4 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 ${!effectiveCanEdit ? 'bg-gray-50 cursor-not-allowed' : 'bg-white cursor-text'}`}
            placeholder={effectiveCanEdit ? "Start writing..." : "You don't have permission to edit this note"}
            style={{cursor: effectiveCanEdit ? 'text' : 'not-allowed'}}
          />
        </div>
      </main>

      {/* Share Modal - same as before */}
      {showShareModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Share Note</h3>
            <form onSubmit={handleShare}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                    Email address
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={shareEmail}
                    onChange={(e) => setShareEmail(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="permission" className="block text-sm font-medium text-gray-700">
                    Permission
                  </label>
                  <select
                    id="permission"
                    value={sharePermission}
                    onChange={(e) => setSharePermission(e.target.value)}
                    className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="read">Read only</option>
                    <option value="write">Can edit</option>
                  </select>
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowShareModal(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Share
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default NoteEditor; 