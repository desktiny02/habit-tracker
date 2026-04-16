'use client';

import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';
import { createTask } from '@/lib/firebase/firestore';
import { collection, query, where, onSnapshot, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Bold, Italic, Underline, List, Clock, Save, StickyNote, Copy, RefreshCcw, X, ChevronDown, ChevronUp } from 'lucide-react';
import { format } from 'date-fns';

interface ScratchNote {
  id: string;
  userId: string;
  content: string; // Stored in 'description' of task
  createdAt: number;
  expiresAt: number | null;
  linkedEventDate?: string;
  isDeleted?: boolean;
  deletedAt?: number | null;
}

export default function ScratchpadPage() {
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<ScratchNote[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<ScratchNote[]>([]);
  const [selectedNote, setSelectedNote] = useState<ScratchNote | null>(null);
  const [showDeleted, setShowDeleted] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);
  const [expiration, setExpiration] = useState('1-week');
  const [isEventLinked, setIsEventLinked] = useState(false);
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  useEffect(() => {
    if (!user) return;

    // We use the 'tasks' collection with itemType 'scratch_note' to bypass rule deployment issues
    const q = query(
      collection(db, 'tasks'),
      where('userId', '==', user.uid),
      where('itemType', '==', 'scratch_note')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const fetchedActive: ScratchNote[] = [];
      const fetchedDeleted: ScratchNote[] = [];

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const note: ScratchNote = {
          id: docSnapshot.id,
          userId: data.userId,
          content: data.description || '',
          createdAt: data.createdAt,
          expiresAt: data.expiresAt || null,
          linkedEventDate: data.linkedEventDate,
          isDeleted: data.isDeleted || false,
          deletedAt: data.deletedAt || null,
        };

        if (note.isDeleted && note.deletedAt) {
          const daysDeleted = (now - note.deletedAt) / (1000 * 60 * 60 * 24);
          if (daysDeleted > 7) {
            deleteDoc(doc(db, 'tasks', note.id)).catch(console.error);
          } else {
            fetchedDeleted.push(note);
          }
        } else if (note.expiresAt !== null && note.expiresAt < now) {
          updateDoc(doc(db, 'tasks', note.id), {
            isDeleted: true,
            deletedAt: now
          }).catch(console.error);
        } else {
          fetchedActive.push(note);
        }
      });

      fetchedActive.sort((a, b) => b.createdAt - a.createdAt);
      fetchedDeleted.sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));
      setNotes(fetchedActive);
      setDeletedNotes(fetchedDeleted);
    });

    return () => unsubscribe();
  }, [user]);

  const handleFormat = (command: string) => {
    document.execCommand(command, false, undefined);
    editorRef.current?.focus();
  };

  const handleSave = async () => {
    if (!user) return;
    const htmlContent = editorRef.current?.innerHTML || '';
    if (!htmlContent.trim() || htmlContent === '<br>') {
      toast.error('Note cannot be empty');
      return;
    }

    setIsSaving(true);
    try {
      const now = Date.now();
      let expiresAt: number | null = null;
      let targetEventDate: string | null = null;

      if (isEventLinked) {
        targetEventDate = eventDate;
        const eventTimestamp = new Date(eventDate + 'T00:00:00').getTime();
        expiresAt = eventTimestamp + (2 * 24 * 60 * 60 * 1000);
      } else {
        if (expiration === '1-day') expiresAt = now + 24 * 60 * 60 * 1000;
        else if (expiration === '1-week') expiresAt = now + 7 * 24 * 60 * 60 * 1000;
        else if (expiration === '1-month') expiresAt = now + 30 * 24 * 60 * 60 * 1000;
      }

      // Save the note as a special task type
      await createTask({
        userId: user.uid,
        name: 'Scratchpad Note',
        description: htmlContent, // Store HTML in description
        itemType: 'scratch_note' as any,
        points: 0,
        priority: 'low',
        required: false,
        repeatType: 'once',
        // Add custom fields
        ...({
           expiresAt,
           linkedEventDate: targetEventDate || null
        } as any)
      });

      // Create linked event if requested
      if (isEventLinked && targetEventDate) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        const title = textContent.trim().substring(0, 40) + (textContent.length > 40 ? '...' : '');

        await createTask({
          userId: user.uid,
          name: `📝 ${title || 'Scratchpad Note'}`,
          description: 'Linked from Scratchpad',
          itemType: 'event',
          points: 0,
          priority: 'medium',
          required: false,
          repeatType: 'once',
          targetDate: targetEventDate,
        });
      }

      toast.success(isEventLinked ? 'Note & Event created!' : 'Note saved!');
      if (editorRef.current) editorRef.current.innerHTML = '';
      setIsEventLinked(false);
      setExpiration('1-week');
    } catch (error: any) {
      console.error('Save error:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, permanent = false) => {
    try {
      if (permanent) {
        await deleteDoc(doc(db, 'tasks', id));
        toast.success('Note permanently removed');
      } else {
        await updateDoc(doc(db, 'tasks', id), {
          isDeleted: true,
          deletedAt: Date.now()
        });
        toast.success('Note moved to deleted');
      }
    } catch (error) {
      toast.error('Failed to remove note');
    }
  };

  const handleRestore = async (id: string) => {
    try {
      await updateDoc(doc(db, 'tasks', id), {
        isDeleted: false,
        deletedAt: null,
        expiresAt: null
      });
      toast.success('Note restored');
    } catch (error) {
      toast.error('Failed to restore note');
    }
  };

  const handleCopy = (htmlContent: string) => {
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const text = tempDiv.textContent || tempDiv.innerText || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      toast.success('Copied to clipboard');
    }
  };

  const truncateHtml = (htmlContent: string) => {
    if (typeof window === 'undefined') return { content: '', isLong: false };
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = htmlContent;
    const plainText = tempDiv.textContent || tempDiv.innerText || '';
    if (plainText.length > 250) {
      return { content: plainText.substring(0, 250) + '...', isLong: true };
    }
    return { content: htmlContent, isLong: false };
  };

  if (loading || !user) {
    return (
      <AppLayout>
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 rounded-full border-[3px] animate-spin" style={{ borderColor: 'var(--bg-raised)', borderTopColor: 'var(--accent)' }} />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="max-w-3xl mx-auto space-y-8">
        
        {/* Header */}
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-subtle)' }}>
              <StickyNote style={{ color: 'var(--accent)', width: 22, height: 22 }} />
            </div>
            <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Scratchpad</h1>
          </div>
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>
            Quick notes and self-reminders. They disappear when you want them to.
          </p>
        </div>

        {/* Editor Area */}
        <div className="rounded-2xl overflow-hidden border" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-raised)' }}>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')} className="p-2 rounded hover:bg-black/10 transition-colors"><Bold size={16} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')} className="p-2 rounded hover:bg-black/10 transition-colors"><Italic size={16} /></button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('underline')} className="p-2 rounded hover:bg-black/10 transition-colors"><Underline size={16} /></button>
            <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }}></div>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('insertUnorderedList')} className="p-2 rounded hover:bg-black/10 transition-colors"><List size={16} /></button>
          </div>

          <div
            ref={editorRef}
            contentEditable
            className="p-4 min-h-[120px] focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
            data-placeholder="Jot something down..."
          />

          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t bg-black/5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-4">
              {!isEventLinked && (
                <div className="flex items-center gap-2">
                  <Clock size={16} style={{ color: 'var(--text-muted)' }} />
                  <select
                    value={expiration}
                    onChange={(e) => setExpiration(e.target.value)}
                    className="text-sm rounded-lg px-2 py-1 focus:outline-none border border-transparent hover:border-white/10"
                    style={{ backgroundColor: 'var(--bg-surface)', color: 'var(--text-primary)' }}
                  >
                    <option value="1-day">Expire in 1 Day</option>
                    <option value="1-week">Expire in 1 Week</option>
                    <option value="1-month">Expire in 1 Month</option>
                    <option value="forever">Keep Forever</option>
                  </select>
                </div>
              )}

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  <input type="checkbox" checked={isEventLinked} onChange={(e) => setIsEventLinked(e.target.checked)} className="rounded border-gray-500 text-indigo-500 w-4 h-4" />
                  Set Event Reminder
                </label>
                {isEventLinked && (
                  <input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="text-sm rounded-lg px-2 py-0.5 border" style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', borderColor: 'var(--border)' }} />
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Save size={16} /> Save Note
            </button>
          </div>
        </div>

        {/* Existing Notes */}
        <div className="space-y-4">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Your Notes</h2>
          {notes.length === 0 ? (
             <div className="text-center py-10 rounded-2xl border border-dashed" style={{ borderColor: 'var(--border-strong)' }}>
               <StickyNote style={{ width: 32, height: 32, color: 'var(--text-muted)', margin: '0 auto', marginBottom: 12, opacity: 0.5 }} />
               <p style={{ color: 'var(--text-muted)' }}>No active notes. Try adding one above!</p>
             </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {notes.map((note) => {
                const { content: displayContent, isLong } = truncateHtml(note.content);
                return (
                  <div key={note.id} className="rounded-2xl p-4 border relative group overflow-hidden flex flex-col h-[280px]" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                    <div className="absolute top-0 right-0 w-8 h-8 rounded-bl-xl bg-black/10 z-0"></div>
                    <div className="relative z-10 flex flex-col h-full">
                      <div className="flex-1 overflow-hidden relative">
                        {isLong ? (
                          <div className="prose prose-sm prose-invert text-sm break-words whitespace-pre-wrap" style={{ color: 'var(--text-primary)' }}>
                            {displayContent}
                          </div>
                        ) : (
                          <div className="prose prose-sm prose-invert text-sm break-words content-renderer" style={{ color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: displayContent }} />
                        )}
                        {isLong && (
                          <button onClick={() => setSelectedNote(note)} className="mt-2 text-sm font-semibold hover:underline" style={{ color: 'var(--accent)' }}>
                            Load more
                          </button>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between pt-3 border-t mt-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
                        <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                          Created: {format(note.createdAt, 'MMM d, h:mm a')}
                          <br/>
                          {note.linkedEventDate ? (
                             <span className="text-sky-400 font-semibold text-[11px]">Event on {format(new Date(note.linkedEventDate), 'MMM d, yyyy')}</span>
                          ) : (
                             note.expiresAt ? `Expires: ${format(note.expiresAt, 'MMM d, yyyy')}` : 'Kept Forever'
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => handleCopy(note.content)} className="p-2 rounded-xl hover:bg-black/10 transition-colors" style={{ color: 'var(--text-primary)' }} title="Copy">
                            <Copy size={16} />
                          </button>
                          <button onClick={() => handleDelete(note.id)} className="p-2 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors" title="Remove">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Deleted Notes Section */}
        {deletedNotes.length > 0 && (
          <div className="mt-12 border-t pt-8" style={{ borderColor: 'var(--border)' }}>
            <button 
              onClick={() => setShowDeleted(!showDeleted)}
              className="flex items-center gap-2 text-sm font-medium mb-4 transition-colors hover:text-white" style={{ color: 'var(--text-secondary)' }}
            >
              {showDeleted ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
              Recently Deleted ({deletedNotes.length})
            </button>
            
            {showDeleted && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {deletedNotes.map((note) => {
                  const { content: displayContent, isLong } = truncateHtml(note.content);
                  return (
                    <div key={note.id} className="rounded-2xl p-4 border relative flex flex-col h-[280px]" style={{ backgroundColor: 'var(--bg-raised)', borderColor: 'var(--border-strong)' }}>
                      <div className="relative z-10 flex flex-col h-full opacity-60 hover:opacity-100 transition-opacity">
                        <div className="flex-1 overflow-hidden relative">
                          {isLong ? (
                            <div className="prose prose-sm prose-invert text-sm break-words whitespace-pre-wrap line-through" style={{ color: 'var(--text-muted)' }}>
                              {displayContent}
                            </div>
                          ) : (
                            <div className="prose prose-sm prose-invert text-sm break-words content-renderer opacity-70" dangerouslySetInnerHTML={{ __html: displayContent }} />
                          )}
                        </div>
                        
                        <div className="flex items-center justify-between pt-3 border-t mt-3 shrink-0" style={{ borderColor: 'var(--border)' }}>
                          <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                            Deleted: {note.deletedAt ? format(note.deletedAt, 'MMM d') : 'Unknown'}
                            <br/>
                            <span>Will be removed in {7 - Math.floor((Date.now() - (note.deletedAt || Date.now())) / (1000 * 60 * 60 * 24))} days</span>
                          </div>
                          <div className="flex items-center gap-2">
                             <button onClick={() => handleRestore(note.id)} className="p-2 rounded-xl text-green-400 hover:bg-green-400/10 transition-colors" title="Restore Note"><RefreshCcw size={16} /></button>
                             <button onClick={() => handleDelete(note.id, true)} className="p-2 rounded-xl text-red-500 hover:bg-red-500/10 transition-colors" title="Delete Permanently"><Trash2 size={16} /></button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Modal for full note */}
        {selectedNote && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedNote(null)}>
            <div 
              className="relative w-full max-w-2xl max-h-[85vh] flex flex-col rounded-2xl border shadow-2xl" 
              style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border)' }}
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b shrink-0" style={{ borderColor: 'var(--border)' }}>
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Full Note</h3>
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCopy(selectedNote.content)} className="p-2 rounded-xl hover:bg-black/10 transition-colors" style={{ color: 'var(--text-primary)' }} title="Copy">
                    <Copy size={18} />
                  </button>
                  <button onClick={() => setSelectedNote(null)} className="p-2 rounded-xl hover:bg-black/10 transition-colors" style={{ color: 'var(--text-primary)' }}>
                    <X size={18} />
                  </button>
                </div>
              </div>
              <div className="p-6 overflow-y-auto flex-1 bg-black/20 rounded-b-2xl">
                <div className="prose prose-sm prose-invert text-base break-words content-renderer" style={{ color: 'var(--text-primary)' }} dangerouslySetInnerHTML={{ __html: selectedNote.content }} />
              </div>
            </div>
          </div>
        )}
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        [contentEditable=true]:empty:before { content: attr(data-placeholder); color: var(--text-muted); pointer-events: none; display: block; }
        .content-renderer ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .content-renderer ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .content-renderer u { text-decoration: underline; }
        .content-renderer b, .content-renderer strong { font-weight: bold; }
        .content-renderer i, .content-renderer em { font-style: italic; }
      `}} />
    </AppLayout>
  );
}
