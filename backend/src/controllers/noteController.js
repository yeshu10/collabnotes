import Note from '../models/Note.js';
import User from '../models/User.js';
import { notifyCollaborators } from '../socket/handler.js';

// @desc    Get all notes for a user
// @route   GET /api/notes
// @access  Private
export const getNotes = async (req, res) => {
  try {
    const userId = req.user._id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const showArchived = req.query.showArchived === 'true';

    console.log(`Notes request from user: ${userId}, page: ${page}, limit: ${limit}`);

    const query = {
      $or: [
        { createdBy: userId },
        { 'collaborators.userId': userId }
      ],
      isArchived: showArchived
    };

    // Check if user has any notes first (optimization for new users)
    const hasNotes = await Note.exists(query);
    console.log(`User ${userId} has notes: ${!!hasNotes}`);
    
    // If user has no notes and it's a new user (page 1), return empty result immediately
    if (!hasNotes && page === 1) {
      console.log(`No notes found for user ${userId}, returning empty result`);
      return res.json({
        notes: [],
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalNotes: 0,
          hasNextPage: false,
          hasPrevPage: false
        }
      });
    }

    const totalNotes = await Note.countDocuments(query);
    const totalPages = Math.ceil(totalNotes / limit) || 1; // Minimum 1 page even if empty

    console.log(`Found ${totalNotes} notes for user ${userId} across ${totalPages} pages`);

    const notes = await Note.find(query)
      .sort({ lastUpdated: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate('createdBy', 'name email')
      .populate('collaborators.userId', 'name email');

    res.json({
      notes,
      pagination: {
        currentPage: page,
        totalPages,
        totalNotes,
        hasNextPage: page < totalPages,
        hasPrevPage: page > 1
      }
    });
  } catch (error) {
    console.error(`Get notes error for user ${req.user?._id}:`, error);
    res.status(500).json({ message: 'Error fetching notes', error: error.message });
  }
};

// @desc    Get single note
// @route   GET /api/notes/:id
// @access  Private
export const getNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('collaborators.userId', 'name email');

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Check access permission
    const isCreator = note.createdBy._id.equals(req.user._id);
    const collaborator = note.collaborators.find(c => c.userId._id.equals(req.user._id));
    const hasAccess = isCreator || collaborator;

    if (!hasAccess) {
      return res.status(403).json({ message: 'Access denied' });
    }

    // Add explicit permission info to the response
    const responseNote = note.toObject();
    responseNote.isOwnedByCurrentUser = isCreator;
    
    // Determine user's permission level
    responseNote.userPermission = isCreator ? 'write' : (collaborator ? collaborator.permission : 'read');
    
    // Add debug info for troubleshooting
    responseNote.permissionInfo = {
      requestUserId: req.user._id.toString(),
      noteCreatorId: note.createdBy._id.toString(),
      isCreator,
      collaboratorInfo: collaborator ? {
        id: collaborator.userId._id.toString(),
        permission: collaborator.permission
      } : null
    };

    console.log('Sending note with permissions:', {
      noteId: note._id.toString(),
      isCreator,
      userPermission: responseNote.userPermission,
      userId: req.user._id.toString()
    });

    res.json(responseNote);
  } catch (error) {
    console.error('Get note error:', error);
    res.status(500).json({ message: 'Error fetching note', error: error.message });
  }
};

// @desc    Create new note
// @route   POST /api/notes
// @access  Private
export const createNote = async (req, res) => {
  try {
    const { title, content } = req.body;

    const note = new Note({
      title,
      content,
      createdBy: req.user._id
    });

    await note.save();
    await note.populate('createdBy', 'name email');

    res.status(201).json(note);
  } catch (error) {
    console.error('Create note error:', error);
    res.status(500).json({ message: 'Error creating note', error: error.message });
  }
};

// @desc    Update note
// @route   PATCH /api/notes/:id
// @access  Private
export const updateNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('collaborators.userId', 'name email');

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // More explicit permission checks
    const isCreator = note.createdBy._id.equals(req.user._id);
    const collaborator = note.collaborators.find(c => c.userId._id.equals(req.user._id));
    
    // Check write permission
    const canWrite = isCreator || 
      (collaborator && collaborator.permission === 'write');

    // Detailed permission debugging
    console.log('Update permission check:', {
      noteId: note._id.toString(),
      requestUserId: req.user._id.toString(),
      noteCreatorId: note.createdBy._id.toString(),
      isCreator,
      collaboratorInfo: collaborator ? {
        id: collaborator.userId._id.toString(),
        permission: collaborator.permission,
        hasWriteAccess: collaborator.permission === 'write'
      } : null,
      canWrite
    });

    if (!canWrite) {
      return res.status(403).json({ 
        message: 'Write access denied',
        permissionInfo: {
          userRole: isCreator ? 'creator' : 'collaborator',
          userId: req.user._id.toString(),
          noteCreatorId: note.createdBy._id.toString(),
          collaborators: note.collaborators.map(c => ({
            userId: c.userId._id.toString(),
            permission: c.permission
          }))
        }
      });
    }

    const { title, content } = req.body;
    
    // Only update fields that are provided
    const updateFields = {};
    if (title !== undefined) updateFields.title = title;
    if (content !== undefined) updateFields.content = content;
    updateFields.lastUpdated = new Date();

    const updatedNote = await Note.findByIdAndUpdate(
      req.params.id,
      { $set: updateFields },
      { new: true }
    )
    .populate('createdBy', 'name email')
    .populate('collaborators.userId', 'name email');

    // Add explicit permission info to the response
    const responseNote = updatedNote.toObject();
    responseNote.isOwnedByCurrentUser = updatedNote.createdBy._id.equals(req.user._id);
    responseNote.userPermission = responseNote.isOwnedByCurrentUser ? 'write' : 
      (collaborator ? collaborator.permission : 'read');

    // Notify collaborators
    notifyCollaborators(updatedNote._id, `Note "${updatedNote.title}" was updated by ${req.user.name}`, req.user._id);

    res.json(responseNote);
  } catch (error) {
    console.error('Update note error:', error);
    res.status(500).json({ 
      message: 'Error updating note', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// @desc    Delete note
// @route   DELETE /api/notes/:id
// @access  Private
export const deleteNote = async (req, res) => {
  try {
    const note = await Note.findById(req.params.id);
    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Only creator can delete
    if (!note.createdBy.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the creator can delete the note' });
    }

    await note.deleteOne();
    res.json({ message: 'Note deleted successfully' });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ message: 'Error deleting note', error: error.message });
  }
};

// @desc    Share note with other users
// @route   POST /api/notes/:id/share
// @access  Private
export const shareNote = async (req, res) => {
  try {
    const { email, permission } = req.body;
    if (!['read', 'write'].includes(permission)) {
      return res.status(400).json({ message: 'Invalid permission type' });
    }

    const note = await Note.findById(req.params.id)
      .populate('createdBy', 'name email')
      .populate('collaborators.userId', 'name email');

    if (!note) {
      return res.status(404).json({ message: 'Note not found' });
    }

    // Only creator can share
    if (!note.createdBy._id.equals(req.user._id)) {
      return res.status(403).json({ message: 'Only the creator can share the note' });
    }

    // Find user to share with
    const collaborator = await User.findOne({ email });
    if (!collaborator) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Debug logging for share operation
    console.log('Share note:', {
      noteId: note._id.toString(),
      creatorId: note.createdBy._id.toString(),
      collaboratorId: collaborator._id.toString(),
      permission,
      existingCollaborators: note.collaborators.map(c => ({
        userId: c.userId._id.toString(),
        permission: c.permission
      }))
    });

    // Check if already shared
    const existingCollaborator = note.collaborators.find(c => 
      c.userId._id.equals(collaborator._id)
    );

    if (existingCollaborator) {
      existingCollaborator.permission = permission;
    } else {
      note.collaborators.push({
        userId: collaborator._id,
        permission
      });
    }

    await note.save();
    
    // Re-populate after save
    await note.populate('createdBy', 'name email');
    await note.populate('collaborators.userId', 'name email');

    // Notify the new collaborator
    notifyCollaborators(
      note._id, 
      `You were given ${permission} access to "${note.title}" by ${req.user.name}`, 
      collaborator._id
    );

    res.json(note);
  } catch (error) {
    console.error('Share note error:', error);
    res.status(500).json({ 
      message: 'Error sharing note', 
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
}; 