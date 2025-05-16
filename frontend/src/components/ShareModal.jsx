import React, { useState } from 'react';
import { useDispatch } from 'react-redux';
import { shareNote } from '../store/slices/notesSlice';
import toast from 'react-hot-toast';

const ShareModal = ({ note, onClose }) => {
    const dispatch = useDispatch();
    const [email, setEmail] = useState('');
    const [permission, setPermission] = useState('read');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errors, setErrors] = useState({});

    // Validate email
    const validateEmail = (email) => {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!email) return 'Email is required';
        if (!emailRegex.test(email)) return 'Invalid email format';
        return '';
    };

    // Handle share
    const handleShare = async (e) => {
        e.preventDefault();
        
        // Validate form
        const emailError = validateEmail(email);
        if (emailError) {
            setErrors({ email: emailError });
            return;
        }

        setIsSubmitting(true);
        setErrors({});

        try {
            await dispatch(shareNote({
                noteId: note._id,
                email,
                permission
            })).unwrap();

            toast.success(`Note shared with ${email}`);
            onClose();
        } catch (error) {
            console.error('Share error:', error);
            setErrors({
                submit: error.message || 'Failed to share note'
            });
            toast.error(error.message || 'Failed to share note');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg p-6 w-full max-w-md">
                <h2 className="text-xl font-bold mb-4">Share Note</h2>
                
                <form onSubmit={handleShare} className="space-y-4">
                    {/* Email Input */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Email Address
                        </label>
                        <input
                            type="email"
                            value={email}
                            onChange={(e) => {
                                setEmail(e.target.value);
                                setErrors({});
                            }}
                            className={`w-full p-2 border rounded-md focus:ring-2 focus:ring-blue-500 ${
                                errors.email ? 'border-red-500' : 'border-gray-300'
                            }`}
                            placeholder="user@example.com"
                            disabled={isSubmitting}
                        />
                        {errors.email && (
                            <p className="mt-1 text-sm text-red-500">{errors.email}</p>
                        )}
                    </div>

                    {/* Permission Select */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Permission Level
                        </label>
                        <select
                            value={permission}
                            onChange={(e) => setPermission(e.target.value)}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500"
                            disabled={isSubmitting}
                        >
                            <option value="read">Read Only</option>
                            <option value="write">Can Edit</option>
                        </select>
                    </div>

                    {/* Current Collaborators */}
                    {note.collaborators.length > 0 && (
                        <div>
                            <h3 className="text-sm font-medium text-gray-700 mb-2">
                                Current Collaborators
                            </h3>
                            <div className="space-y-2">
                                {note.collaborators.map((collab) => (
                                    <div
                                        key={collab.userId._id}
                                        className="flex items-center justify-between p-2 bg-gray-50 rounded-md"
                                    >
                                        <span>{collab.userId.email}</span>
                                        <span className={`text-sm ${
                                            collab.permission === 'write'
                                                ? 'text-green-600'
                                                : 'text-blue-600'
                                        }`}>
                                            {collab.permission}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Error Message */}
                    {errors.submit && (
                        <p className="text-sm text-red-500">{errors.submit}</p>
                    )}

                    {/* Buttons */}
                    <div className="flex justify-end space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
                            disabled={isSubmitting}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            className={`px-4 py-2 text-sm text-white bg-blue-500 rounded-md hover:bg-blue-600 
                                ${isSubmitting ? 'opacity-50 cursor-not-allowed' : ''}`}
                            disabled={isSubmitting}
                        >
                            {isSubmitting ? 'Sharing...' : 'Share'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ShareModal; 