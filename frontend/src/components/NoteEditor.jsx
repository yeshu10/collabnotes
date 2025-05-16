import React, { useState, useEffect, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import debounce from 'lodash/debounce';
import { updateNoteInRealTime } from '../services/socket';
import { updateNote } from '../store/slices/notesSlice';
import { FaEdit, FaEye } from 'react-icons/fa';
import toast from 'react-hot-toast';

const NoteEditor = ({ note, userRole, collaborators }) => {
    const dispatch = useDispatch();
    const [content, setContent] = useState(note.content);
    const [title, setTitle] = useState(note.title);
    const [isSaving, setIsSaving] = useState(false);
    const [lastSaved, setLastSaved] = useState(new Date());

    // Determine if user can edit
    const canEdit = userRole === 'creator' || 
        (userRole === 'collaborator' && note.collaborators.find(c => 
            c.userId._id === localStorage.getItem('userId'))?.permission === 'write');

    // Debounced save function
    const debouncedSave = useCallback(
        debounce(async (noteId, newContent, newTitle) => {
            try {
                setIsSaving(true);
                // Update in real-time via socket
                updateNoteInRealTime(noteId, newContent, newTitle);
                
                // Update local state
                dispatch(updateNote({
                    _id: noteId,
                    content: newContent,
                    title: newTitle,
                    lastUpdated: new Date()
                }));

                setLastSaved(new Date());
                setIsSaving(false);
            } catch (error) {
                console.error('Error saving note:', error);
                toast.error('Failed to save changes');
                setIsSaving(false);
            }
        }, 1000),
        []
    );

    // Handle content change
    const handleContentChange = (e) => {
        const newContent = e.target.value;
        setContent(newContent);
        debouncedSave(note._id, newContent, title);
    };

    // Handle title change
    const handleTitleChange = (e) => {
        const newTitle = e.target.value;
        setTitle(newTitle);
        debouncedSave(note._id, content, newTitle);
    };

    // Update local state when note changes
    useEffect(() => {
        setContent(note.content);
        setTitle(note.title);
    }, [note]);

    return (
        <div className="space-y-4">
            {/* Title and Status Bar */}
            <div className="flex items-center justify-between">
                <div className="flex-1">
                    <input
                        type="text"
                        value={title}
                        onChange={handleTitleChange}
                        disabled={!canEdit}
                        className="w-full text-2xl font-bold border-none focus:ring-2 focus:ring-blue-500 rounded px-2 py-1"
                        placeholder="Note Title"
                    />
                </div>
                <div className="flex items-center space-x-4 text-sm text-gray-500">
                    {/* Access Status */}
                    <div className="flex items-center">
                        {canEdit ? (
                            <FaEdit className="text-green-500" title="Can Edit" />
                        ) : (
                            <FaEye className="text-blue-500" title="Read Only" />
                        )}
                    </div>
                    {/* Save Status */}
                    <div>
                        {isSaving ? (
                            <span>Saving...</span>
                        ) : (
                            <span>Last saved: {new Date(lastSaved).toLocaleTimeString()}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* Collaborators List */}
            <div className="flex flex-wrap gap-2 mb-4">
                {collaborators.map((collab) => (
                    <div
                        key={collab.userId._id}
                        className={`px-3 py-1 rounded-full text-sm ${
                            collab.permission === 'write' 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-blue-100 text-blue-800'
                        }`}
                    >
                        {collab.userId.name} ({collab.permission})
                    </div>
                ))}
            </div>

            {/* Editor */}
            <textarea
                value={content}
                onChange={handleContentChange}
                disabled={!canEdit}
                className="w-full h-[calc(100vh-250px)] p-4 border rounded-lg focus:ring-2 focus:ring-blue-500 resize-none"
                placeholder={canEdit ? "Start writing..." : "You don't have permission to edit this note"}
            />
        </div>
    );
};

export default NoteEditor; 