import React, { useEffect, useState, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { notesAPI } from '../services/api';
import { setNotes, setLoading, setError, addNote, removeNote } from '../store/slices/notesSlice';
import { logout, setCredentials } from '../store/slices/authSlice';
import { disconnectSocket, initializeSocket } from '../services/socket';
import toast from 'react-hot-toast';
import { FaShare, FaTrash } from 'react-icons/fa';

const Dashboard = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { notes, loading } = useSelector((state) => state.notes);
  const { user, token } = useSelector((state) => state.auth);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteContent, setNewNoteContent] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isFetching, setIsFetching] = useState(false);
  const initialFetchDone = useRef(false);
  const [pageLoading, setPageLoading] = useState(true);

  // Combine the two useEffects into one to prevent multiple fetch calls
  useEffect(() => {
    console.log('Dashboard mounted or dependencies changed', { 
      user: !!user, 
      notes: notes.length, 
      loading, 
      isFetching,
      initialFetchDone: initialFetchDone.current,
      page
    });
    
    // Check if we're logged in and haven't fetched notes yet
    const shouldFetchNotes = user && 
                            !loading && 
                            !isFetching && 
                            (!initialFetchDone.current || page > 1);
                            
    if (shouldFetchNotes) {
      console.log('Fetching notes based on condition check');
      fetchNotes();
      if (!initialFetchDone.current) {
        initialFetchDone.current = true;
        console.log('Setting initialFetchDone to true');
      }
    }
  }, [user, page]);

  useEffect(() => {
    // Check if we have user data from localStorage but not in state
    if (token && !user) {
      // This can happen on page refresh when token exists but Redux state was reset
      const storedUser = localStorage.getItem('user');
      if (storedUser) {
        try {
          const userData = JSON.parse(storedUser);
          dispatch(setCredentials({ user: userData, token }));
          console.log('Restored user from localStorage:', userData.name);
        } catch (error) {
          console.error('Error parsing stored user:', error);
        }
      }
    }
    
    // Set page as loaded after a short delay
    setTimeout(() => {
      setPageLoading(false);
    }, 500);
  }, []);

  // Ensure socket is connected when dashboard loads
  useEffect(() => {
    console.log('Dashboard mounted, checking socket connection');
    if (token) {
      initializeSocket(token);
    }
    
    return () => {
      // No need to disconnect socket on dashboard unmount
      // as we want to keep it active for other components
    };
  }, [token]);

  const fetchNotes = async () => {
    if (loading || isFetching) {
      console.log('Already loading notes, skipping fetch');
      return;
    }
    
    setIsFetching(true);
    console.log('Starting to fetch notes for page:', page);
    dispatch(setLoading(true));
    try {
      const response = await notesAPI.getAllNotes(page);
      console.log('Notes fetched successfully:', response);
      dispatch(setNotes(response.notes));
      setPagination(response.pagination);
    } catch (error) {
      console.error('Error fetching notes:', error);
      dispatch(setError(error.response?.data?.message || 'Error fetching notes'));
      toast.error('Error fetching notes');
    } finally {
      dispatch(setLoading(false));
      setIsFetching(false);
      console.log('Fetch complete, loading and isFetching set to false');
    }
  };

  const handleCreateNote = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    
    if (!newNoteTitle.trim()) {
      toast.error('Title is required');
      return;
    }

    setIsSubmitting(true);
    try {
      console.log('Creating new note:', { title: newNoteTitle, content: newNoteContent || 'New note' });
      const data = await notesAPI.createNote(newNoteTitle, newNoteContent || 'New note');
      console.log('Note created successfully:', data);
      dispatch(addNote(data));
      toast.success('Note created successfully');
      setShowCreateModal(false);
      navigate(`/notes/${data._id}`);
    } catch (error) {
      console.error('Create note error:', error);
      toast.error(error.response?.data?.message || 'Error creating note');
    } finally {
      setIsSubmitting(false);
      setNewNoteTitle('');
      setNewNoteContent('');
    }
  };

  const handleLogout = () => {
    dispatch(logout());
    disconnectSocket();
    navigate('/login');
  };

  const handleDeleteNote = async (noteId) => {
    if (window.confirm('Are you sure you want to delete this note?')) {
      try {
        await notesAPI.deleteNote(noteId);
        dispatch(removeNote(noteId));
        toast.success('Note deleted successfully');
      } catch (error) {
        console.error('Delete note error:', error);
        toast.error(error.message || 'Error deleting note');
      }
    }
  };

  // Show loading state while page is initially loading
  if (pageLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading your notes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-bold text-gray-900">Collaborative Notes</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-gray-700">Welcome, {user?.name || 'User'}</span>
              <button
                onClick={handleLogout}
                className="text-gray-700 hover:text-gray-900"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-900">My Notes</h2>
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Create New Note
            </button>
          </div>

          {loading ? (
            <div className="text-center">Loading...</div>
          ) : notes && notes.length > 0 ? (
            <>
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {notes.map((note) => (
                  <div
                    key={note._id}
                    className="bg-white overflow-hidden shadow rounded-lg hover:shadow-md transition-shadow duration-200"
                  >
                    <div 
                      className="px-4 py-5 sm:p-6 cursor-pointer"
                      onClick={() => navigate(`/notes/${note._id}`)}
                    >
                      <h3 className="text-lg font-medium text-gray-900 truncate">
                        {note.title}
                      </h3>
                      <div className="mt-2">
                        <p className="text-sm text-gray-500">
                          Last updated: {new Date(note.lastUpdated).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-gray-500">
                          Collaborators: {note.collaborators.length}
                        </p>
                      </div>
                    </div>
                    <div className="px-4 py-3 bg-gray-50 flex justify-end space-x-2">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/notes/${note._id}?share=true`);
                        }}
                        className="text-blue-600 hover:text-blue-800 p-1"
                        title="Share Note"
                      >
                        <FaShare />
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteNote(note._id);
                        }}
                        className="text-red-600 hover:text-red-800 p-1"
                        title="Delete Note"
                      >
                        <FaTrash />
                      </button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {pagination && pagination.totalPages > 1 && (
                <div className="mt-6 flex justify-center space-x-4">
                  <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={!pagination.hasPrevPage}
                    className={`px-4 py-2 text-sm rounded-md ${
                      pagination.hasPrevPage
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    Previous
                  </button>
                  <span className="text-sm text-gray-600 self-center">
                    Page {pagination.currentPage} of {pagination.totalPages}
                  </span>
                  <button
                    onClick={() => setPage(p => p + 1)}
                    disabled={!pagination.hasNextPage}
                    className={`px-4 py-2 text-sm rounded-md ${
                      pagination.hasNextPage
                        ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                        : 'bg-gray-200 text-gray-500'
                    }`}
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="text-center text-gray-500">No notes found</div>
          )}
        </div>
      </main>

      {showCreateModal && (
        <div className="fixed inset-0 bg-gray-500 bg-opacity-75 flex items-center justify-center">
          <div className="bg-white rounded-lg p-6 max-w-sm w-full">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Create New Note</h3>
            <form onSubmit={handleCreateNote}>
              <div className="space-y-4">
                <div>
                  <label htmlFor="title" className="block text-sm font-medium text-gray-700">
                    Title
                  </label>
                  <input
                    id="title"
                    type="text"
                    value={newNoteTitle}
                    onChange={(e) => setNewNoteTitle(e.target.value)}
                    placeholder="Note title"
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    required
                  />
                </div>
                <div>
                  <label htmlFor="content" className="block text-sm font-medium text-gray-700">
                    Initial Content
                  </label>
                  <textarea
                    id="content"
                    value={newNoteContent}
                    onChange={(e) => setNewNoteContent(e.target.value)}
                    placeholder="Start writing..."
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500"
                    rows={4}
                  />
                </div>
              </div>
              <div className="mt-4 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowCreateModal(false);
                    setNewNoteTitle('');
                    setNewNoteContent('');
                  }}
                  className="px-4 py-2 text-sm font-medium text-gray-700 hover:text-gray-900"
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={`px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 ${
                    isSubmitting ? 'opacity-50 cursor-not-allowed' : ''
                  }`}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? 'Creating...' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard; 