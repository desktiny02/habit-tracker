'use client';

import AppLayout from '@/components/layout/AppLayout';
import { useAuth } from '@/lib/firebase/auth';
import { db } from '@/lib/firebase/config';
import { collection, query, where, onSnapshot, addDoc, serverTimestamp, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { useEffect, useState, useRef } from 'react';
import toast from 'react-hot-toast';
import { Trash2, Bold, Italic, Underline, List, Clock, Save, StickyNote } from 'lucide-react';
import { format } from 'date-fns';

interface ScratchpadNote {
  id: string;
  userId: string;
  content: string;
  createdAt: number;
  expiresAt: number | null;
  linkedEventDate?: string;
}

export default function ScratchpadPage() {
  const { user, loading } = useAuth();
  const [notes, setNotes] = useState<ScratchpadNote[]>([]);
  const [content, setContent] = useState('');
  const [expiration, setExpiration] = useState('1-week');
  const [isEventLinked, setIsEventLinked] = useState(false);
  const [eventDate, setEventDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [isSaving, setIsSaving] = useState(false);
  const editorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'scratchpads'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const now = Date.now();
      const fetchedNotes: ScratchpadNote[] = [];
      let cleanupNeeded = false;

      snapshot.forEach((docSnapshot) => {
        const data = docSnapshot.data();
        const note: ScratchpadNote = {
          id: docSnapshot.id,
          userId: data.userId,
          content: data.content,
          createdAt: data.createdAt,
          expiresAt: data.expiresAt,
          linkedEventDate: data.linkedEventDate,
        };

        if (note.expiresAt !== null && note.expiresAt < now) {
          // Expired, we should delete it from db
          cleanupNeeded = true;
          deleteDoc(doc(db, 'scratchpads', note.id)).catch(console.error);
        } else {
          fetchedNotes.push(note);
        }
      });

      // Sort by newest first
      fetchedNotes.sort((a, b) => b.createdAt - a.createdAt);
      setNotes(fetchedNotes);
    });

    return () => unsubscribe();
  }, [user]);

  const handleFormat = (command: string) => {
    document.execCommand(command, false, undefined);
    if (editorRef.current) {
      editorRef.current.focus();
    }
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
        // Expire 1 full day after the event date (adding 48 hours from midnight of that day as safety)
        const eventTimestamp = new Date(eventDate + 'T00:00:00').getTime();
        expiresAt = eventTimestamp + (2 * 24 * 60 * 60 * 1000);
      } else {
        if (expiration === '1-day') expiresAt = now + 24 * 60 * 60 * 1000;
        else if (expiration === '1-week') expiresAt = now + 7 * 24 * 60 * 60 * 1000;
        else if (expiration === '1-month') expiresAt = now + 30 * 24 * 60 * 60 * 1000;
      }

      await addDoc(collection(db, 'scratchpads'), {
        userId: user.uid,
        content: htmlContent,
        createdAt: now,
        expiresAt: expiresAt,
        ...(isEventLinked && { linkedEventDate: targetEventDate }),
      });

      // Create linked event in Tasks
      if (isEventLinked && targetEventDate) {
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = htmlContent;
        const textContent = tempDiv.textContent || tempDiv.innerText || '';
        const title = textContent.trim().substring(0, 40) + (textContent.length > 40 ? '...' : '');

        await addDoc(collection(db, 'tasks'), {
          userId: user.uid,
          name: `📝 ${title || 'Scratchpad Note'}`,
          description: 'Linked from Scratchpad',
          itemType: 'event',
          priority: 'medium',
          required: false,
          repeatType: 'once',
          targetDate: targetEventDate,
          createdAt: now,
        });
      }

      toast.success(isEventLinked ? 'Note saved and Event created!' : 'Note saved!');
      if (editorRef.current) {
        editorRef.current.innerHTML = '';
      }
      setContent('');
      setIsEventLinked(false);
      setExpiration('1-week');
    } catch (error: any) {
      toast.error('Failed to save note');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'scratchpads', id));
      toast.success('Note removed');
    } catch (error) {
      toast.error('Failed to remove note');
    }
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
          {/* Toolbar */}
          <div className="flex items-center gap-1 p-2 border-b" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-raised)' }}>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('bold')} className="p-2 rounded hover:bg-black/10 transition-colors" title="Bold">
              <Bold size={16} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('italic')} className="p-2 rounded hover:bg-black/10 transition-colors" title="Italic">
              <Italic size={16} />
            </button>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('underline')} className="p-2 rounded hover:bg-black/10 transition-colors" title="Underline">
              <Underline size={16} />
            </button>
            <div className="w-px h-5 mx-1" style={{ backgroundColor: 'var(--border)' }}></div>
            <button onMouseDown={(e) => e.preventDefault()} onClick={() => handleFormat('insertUnorderedList')} className="p-2 rounded hover:bg-black/10 transition-colors" title="Bullet List">
              <List size={16} />
            </button>
          </div>

          {/* Editor */}
          <div
            ref={editorRef}
            contentEditable
            onInput={(e) => setContent(e.currentTarget.innerHTML)}
            className="p-4 min-h-[120px] focus:outline-none"
            style={{ color: 'var(--text-primary)' }}
            data-placeholder="Jot something down..."
          />

          {/* Footer Controls */}
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 border-t bg-black/5" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-wrap items-center gap-4">
              {/* Normal Expiration */}
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

              {/* Event Reminder Toggle */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  <input 
                    type="checkbox" 
                    checked={isEventLinked} 
                    onChange={(e) => setIsEventLinked(e.target.checked)}
                    className="rounded border-gray-500 text-indigo-500 focus:ring-indigo-500 bg-transparent w-4 h-4 cursor-pointer"
                  />
                  Set Event Reminder
                </label>
                
                {isEventLinked && (
                  <input 
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="text-sm rounded-lg px-2 py-0.5 border focus:outline-none"
                    style={{ backgroundColor: 'var(--bg-raised)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                  />
                )}
              </div>
            </div>

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="px-4 py-2 rounded-xl text-sm font-bold text-white flex items-center gap-2 transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: 'var(--accent)' }}
            >
              <Save size={16} />
              Save Note
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
              {notes.map((note) => (
                <div key={note.id} className="rounded-2xl p-4 border relative group overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', borderColor: 'var(--border-strong)' }}>
                  
                  {/* Decorative corner curve */}
                  <div className="absolute top-0 right-0 w-8 h-8 rounded-bl-xl bg-black/10 z-0"></div>

                  <div className="relative z-10 flex flex-col h-full">
                    {/* Note content */}
                    <div 
                      className="prose prose-sm prose-invert mb-4 flex-1 text-sm break-words content-renderer"
                      style={{ color: 'var(--text-primary)' }}
                      dangerouslySetInnerHTML={{ __html: note.content }}
                    />
                    
                    {/* Meta info & Delete */}
                    <div className="flex items-center justify-between pt-3 border-t mt-auto" style={{ borderColor: 'var(--border)' }}>
                      <div className="text-[10px] font-medium" style={{ color: 'var(--text-muted)' }}>
                        Created: {format(note.createdAt, 'MMM d, h:mm a')}
                        <br/>
                        {note.linkedEventDate ? (
                           <span className="text-sky-400 font-semibold text-[11px]">Event on {format(new Date(note.linkedEventDate), 'MMM d, yyyy')}</span>
                        ) : (
                           note.expiresAt ? `Expires: ${format(note.expiresAt, 'MMM d, yyyy')}` : 'Kept Forever'
                        )}
                      </div>
                      <button
                        onClick={() => handleDelete(note.id)}
                        className="p-2 rounded-xl text-red-400 hover:bg-red-400/10 transition-colors opacity-0 group-hover:opacity-100"
                        title="Delete note"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        [contentEditable=true]:empty:before {
          content: attr(data-placeholder);
          color: var(--text-muted);
          pointer-events: none;
          display: block; /* For Firefox */
        }
        .content-renderer ul { list-style-type: disc; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .content-renderer ol { list-style-type: decimal; padding-left: 1.5rem; margin-top: 0.5rem; margin-bottom: 0.5rem; }
        .content-renderer u { text-decoration: underline; }
        .content-renderer b, .content-renderer strong { font-weight: bold; }
        .content-renderer i, .content-renderer em { font-style: italic; }
      `}} />

    </AppLayout>
  );
}
