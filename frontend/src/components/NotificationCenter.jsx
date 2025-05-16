import React, { useState, useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { FaBell, FaCheck, FaTrash } from 'react-icons/fa';
import { getNotifications, markNotificationsRead, deleteNotifications } from '../store/slices/notificationsSlice';
import toast from 'react-hot-toast';

const NotificationCenter = () => {
    const dispatch = useDispatch();
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIds, setSelectedIds] = useState([]);
    const [page, setPage] = useState(1);
    
    const { 
        notifications, 
        loading, 
        pagination,
        unreadCount 
    } = useSelector(state => state.notifications);

    // Fetch notifications on mount and when page changes
    useEffect(() => {
        dispatch(getNotifications({ page, limit: 10 }));
    }, [dispatch, page]);

    // Handle mark as read
    const handleMarkRead = async () => {
        if (selectedIds.length === 0) return;

        try {
            await dispatch(markNotificationsRead({ notificationIds: selectedIds })).unwrap();
            setSelectedIds([]);
            toast.success('Notifications marked as read');
        } catch (error) {
            toast.error('Failed to mark notifications as read');
        }
    };

    // Handle delete
    const handleDelete = async () => {
        if (selectedIds.length === 0) return;

        try {
            await dispatch(deleteNotifications({ notificationIds: selectedIds })).unwrap();
            setSelectedIds([]);
            toast.success('Notifications deleted');
        } catch (error) {
            toast.error('Failed to delete notifications');
        }
    };

    // Toggle notification selection
    const toggleSelect = (id) => {
        setSelectedIds(prev => 
            prev.includes(id) 
                ? prev.filter(i => i !== id)
                : [...prev, id]
        );
    };

    return (
        <div className="relative">
            {/* Notification Bell */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 text-gray-600 hover:text-gray-800"
            >
                <FaBell className="w-6 h-6" />
                {unreadCount > 0 && (
                    <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/2 -translate-y-1/2 bg-red-500 rounded-full">
                        {unreadCount}
                    </span>
                )}
            </button>

            {/* Notification Panel */}
            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 bg-white rounded-lg shadow-xl z-50">
                    <div className="p-4 border-b">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-semibold">Notifications</h3>
                            <div className="flex space-x-2">
                                <button
                                    onClick={handleMarkRead}
                                    disabled={selectedIds.length === 0}
                                    className={`p-1 rounded ${
                                        selectedIds.length > 0 
                                            ? 'text-blue-500 hover:bg-blue-50' 
                                            : 'text-gray-400'
                                    }`}
                                    title="Mark as read"
                                >
                                    <FaCheck />
                                </button>
                                <button
                                    onClick={handleDelete}
                                    disabled={selectedIds.length === 0}
                                    className={`p-1 rounded ${
                                        selectedIds.length > 0 
                                            ? 'text-red-500 hover:bg-red-50' 
                                            : 'text-gray-400'
                                    }`}
                                    title="Delete"
                                >
                                    <FaTrash />
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Notifications List */}
                    <div className="max-h-96 overflow-y-auto">
                        {loading ? (
                            <div className="p-4 text-center text-gray-500">
                                Loading...
                            </div>
                        ) : notifications.length === 0 ? (
                            <div className="p-4 text-center text-gray-500">
                                No notifications
                            </div>
                        ) : (
                            <div className="divide-y">
                                {notifications.map((notification) => (
                                    <div
                                        key={notification._id}
                                        className={`p-4 hover:bg-gray-50 cursor-pointer ${
                                            !notification.read ? 'bg-blue-50' : ''
                                        }`}
                                        onClick={() => toggleSelect(notification._id)}
                                    >
                                        <div className="flex items-start">
                                            <input
                                                type="checkbox"
                                                checked={selectedIds.includes(notification._id)}
                                                onChange={() => toggleSelect(notification._id)}
                                                className="mt-1 mr-3"
                                            />
                                            <div>
                                                <p className="text-sm">{notification.message}</p>
                                                <p className="text-xs text-gray-500 mt-1">
                                                    {new Date(notification.createdAt).toLocaleString()}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Pagination */}
                    {pagination && pagination.totalPages > 1 && (
                        <div className="p-4 border-t flex justify-between items-center">
                            <button
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                                disabled={!pagination.hasPrevPage}
                                className={`px-3 py-1 text-sm rounded ${
                                    pagination.hasPrevPage
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-gray-200 text-gray-500'
                                }`}
                            >
                                Previous
                            </button>
                            <span className="text-sm text-gray-500">
                                Page {pagination.currentPage} of {pagination.totalPages}
                            </span>
                            <button
                                onClick={() => setPage(p => p + 1)}
                                disabled={!pagination.hasNextPage}
                                className={`px-3 py-1 text-sm rounded ${
                                    pagination.hasNextPage
                                        ? 'bg-blue-500 text-white hover:bg-blue-600'
                                        : 'bg-gray-200 text-gray-500'
                                }`}
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default NotificationCenter; 