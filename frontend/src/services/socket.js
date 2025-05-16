import { io } from 'socket.io-client';
import { store } from '../store';
import { updateNote } from '../store/slices/notesSlice';
import toast from 'react-hot-toast';

let socket = null;
let currentNoteId = null;

export const initializeSocket = (token) => {
  if (socket) {
    // If already connected, just return
    if (socket.connected) {
      console.log('Socket already connected');
      return;
    }
    // If disconnected, clean up first
    socket.disconnect();
    socket = null;
  }

  socket = io('http://localhost:5000', {
    auth: { token },
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5
  });

  socket.on('connect', () => {
    console.log('Socket connected');
    // Rejoin current note room if any
    if (currentNoteId) {
      joinNoteRoom(currentNoteId);
    }
  });

  socket.on('disconnect', () => {
    console.log('Socket disconnected');
  });

  socket.on('connect_error', (error) => {
    console.error('Socket connection error:', error);
    toast.error('Lost connection to server. Trying to reconnect...');
  });

  socket.on('note-updated', (data) => {
    console.log('Received note update:', data);
    store.dispatch(updateNote(data));
    toast.success(`Note "${data.title}" has been updated`);
  });

  socket.on('notification', (data) => {
    console.log('Received notification:', data);
    toast(data.message, {
      icon: '📝',
    });
  });
};

export const joinNoteRoom = (noteId) => {
  if (!socket?.connected) {
    console.warn('Socket not connected when trying to join room');
    return;
  }
  currentNoteId = noteId;
  socket.emit('join-note', noteId);
  console.log('Joining note room:', noteId);
};

export const leaveNoteRoom = (noteId) => {
  if (!socket?.connected) {
    console.warn('Socket not connected when trying to leave room');
    return;
  }
  currentNoteId = null;
  socket.emit('leave-note', noteId);
  console.log('Leaving note room:', noteId);
};

export const updateNoteInRealTime = (noteId, content, title) => {
  if (!socket?.connected) {
    console.warn('Socket not connected when trying to update note');
    return;
  }
  socket.emit('note-update', { noteId, content, title });
  console.log('Sending note update:', { noteId, content, title });
};

export const disconnectSocket = () => {
  if (socket) {
    currentNoteId = null;
    socket.disconnect();
    socket = null;
    console.log('Socket disconnected manually');
  }
}; 