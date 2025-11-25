
import React, { useState, useEffect, useRef } from 'react';
import { ChatRoom, Message, RoomType, Profile } from '../types';
import { 
  Send, Users, Hash, Search, Zap, Loader2, 
  MessageSquare, User, Smile, MoreVertical 
} from 'lucide-react';
import { supabase } from '../lib/supabaseClient';

// --- CONFIG & CONSTANTS ---
const ANIMALS = ['Panda', 'Tiger', 'Fox', 'Eagle', 'Shark', 'Owl'];
const COLORS = ['text-red-400', 'text-blue-400', 'text-green-400', 'text-yellow-400', 'text-purple-400'];

const Chat: React.FC = () => {
  // --- STATE ---
  const [currentUser, setCurrentUser] = useState<Profile | null>(null);
  
  // Zone A: Sidebar State
  const [publicRooms, setPublicRooms] = useState<ChatRoom[]>([]);
  const [privateRooms, setPrivateRooms] = useState<ChatRoom[]>([]);
  const [activeRoom, setActiveRoom] = useState<ChatRoom | null>(null);
  const [isSearchingMatch, setIsSearchingMatch] = useState(false);
  
  // Zone B: Chat Area State
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Zone C: Context State
  const [onlineCount, setOnlineCount] = useState<number>(0);

  // --- 1. INITIALIZATION & AUTH ---
  useEffect(() => {
    const init = async () => {
      // 1. Get Auth Session
      const { data: { session } } = await supabase.auth.getSession();
      let userId = session?.user?.id;

      if (!userId) {
        // Anon sign in for demo
        const { data } = await supabase.auth.signInAnonymously();
        userId = data.user?.id;
      }

      if (userId) {
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', userId).single();
        setCurrentUser(profile);
      }

      // 2. Fetch Public Rooms
      const { data: rooms } = await supabase.from('rooms').select('*').eq('type', 'public');
      if (rooms) {
        setPublicRooms(rooms as ChatRoom[]);
        setActiveRoom(rooms[0]); // Default to General
      }

      // 3. Fetch My Private Matches (Rooms I'm in)
      const { data: myMatches } = await supabase
        .from('room_participants')
        .select('room_id, rooms(*)')
        .eq('user_id', userId);
      
      if (myMatches) {
        // Fix Supabase join typing: map results, handle potential array, and cast to ChatRoom[]
        const matches = myMatches.map((m: any) => {
            const room = m.rooms;
            return Array.isArray(room) ? room[0] : room;
        }).filter((r: any) => r && r.type === 'match');

        setPrivateRooms(matches as ChatRoom[]);
      }
    };
    init();
  }, []);

  // --- 2. RANDOM MATCHMAKING LOGIC ---
  const handleFindMatch = async () => {
    if (!currentUser) return;
    setIsSearchingMatch(true);

    try {
      // Call the Database Function we created
      const { data: roomId, error } = await supabase.rpc('find_or_create_match', {
        my_user_id: currentUser.id
      });

      if (error) throw error;

      if (roomId) {
        // Match found immediately!
        joinMatchRoom(roomId);
      } else {
        // Added to queue, wait for a match via Realtime
        subscribeToQueueMatches();
      }
    } catch (e) {
      console.error("Match error", e);
      setIsSearchingMatch(false);
    }
  };

  const subscribeToQueueMatches = () => {
    // Listen to 'room_participants' to see if I get added to a room
    const channel = supabase.channel('queue_listener')
      .on(
        'postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'room_participants', filter: `user_id=eq.${currentUser?.id}` }, 
        async (payload) => {
          // I was added to a room!
          const newRoomId = payload.new.room_id;
          joinMatchRoom(newRoomId);
          supabase.removeChannel(channel);
        }
      )
      .subscribe();
  };

  const joinMatchRoom = async (roomId: string) => {
    setIsSearchingMatch(false);
    // Fetch room details
    const { data } = await supabase.from('rooms').select('*').eq('id', roomId).single();
    if (data) {
        setPrivateRooms(prev => [data, ...prev]);
        setActiveRoom(data);
    }
  };

  // --- 3. MESSAGING LOGIC (REALTIME) ---
  useEffect(() => {
    if (!activeRoom) return;

    // Load initial messages
    const fetchMsgs = async () => {
        const { data } = await supabase
            .from('messages')
            .select('*, profiles(username, avatar_url)')
            .eq('room_id', activeRoom.id)
            .order('created_at', { ascending: true });
        setMessages(data || []);
    };
    fetchMsgs();

    // Subscribe to new messages
    const channel = supabase
        .channel(`room:${activeRoom.id}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', filter: `room_id=eq.${activeRoom.id}` }, async (payload) => {
            const newMsg = payload.new as Message;
            // Fetch profile for the new message to display avatar immediately
            const { data } = await supabase.from('profiles').select('username, avatar_url').eq('id', newMsg.user_id).single();
            newMsg.profiles = data as Profile;
            setMessages(prev => [...prev, newMsg]);
        })
        .subscribe();
        
    // Mock Online Count
    setOnlineCount(Math.floor(Math.random() * 50) + 5);

    return () => { supabase.removeChannel(channel); };
  }, [activeRoom]);

  // Scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const sendMessage = async () => {
    if (!inputText.trim() || !currentUser || !activeRoom) return;
    
    // Logic: If Match Room -> Anonymous by default
    const isAnon = activeRoom.type === 'match';
    const fakeName = isAnon ? `Anonymous ${ANIMALS[Math.floor(Math.random() * ANIMALS.length)]}` : undefined;

    const { error } = await supabase.from('messages').insert({
        room_id: activeRoom.id,
        user_id: currentUser.id,
        content: inputText,
        is_anonymous: isAnon,
        fake_username: fakeName
    });

    if (!error) setInputText('');
  };

  // --- 4. RENDER HELPERS ---
  const isMessageGrouped = (index: number) => {
      if (index === 0) return false;
      const current = messages[index];
      const prev = messages[index - 1];
      // Group if same user and within 5 minutes
      const timeDiff = new Date(current.created_at).getTime() - new Date(prev.created_at).getTime();
      return current.user_id === prev.user_id && timeDiff < 5 * 60 * 1000;
  };

  return (
    <div className="flex h-[calc(100vh-64px)] bg-slate-900 text-slate-100 overflow-hidden font-sans">
      
      {/* --- ZONE A: NAVIGATION SIDEBAR --- */}
      <div className="w-72 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col">
        
        {/* Global/Broadcast Header */}
        <div className="p-4 border-b border-slate-800">
           <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Broadcast Channels</h2>
           <div className="space-y-1">
             {publicRooms.map(room => (
               <button 
                 key={room.id}
                 onClick={() => setActiveRoom(room)}
                 className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${activeRoom?.id === room.id ? 'bg-indigo-600/20 text-indigo-400' : 'text-slate-400 hover:bg-slate-800 hover:text-slate-200'}`}
               >
                 <Hash size={18} />
                 <span className="font-medium truncate">#{room.name}</span>
               </button>
             ))}
           </div>
        </div>

        {/* Active Chats / Matches */}
        <div className="flex-1 overflow-y-auto p-4">
           <h2 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">Private Matches</h2>
           <div className="space-y-1">
             {privateRooms.map((room, idx) => (
               <button 
                 key={room.id}
                 onClick={() => setActiveRoom(room)}
                 className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${activeRoom?.id === room.id ? 'bg-slate-800 text-white' : 'text-slate-400 hover:bg-slate-800'}`}
               >
                 <div className="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center">
                    <Zap size={14} className="text-yellow-400" />
                 </div>
                 <div className="flex-1 text-left">
                    <div className="text-sm font-medium text-slate-200">Anon Match #{idx + 1}</div>
                    <div className="text-xs text-slate-500 truncate">Click to chat</div>
                 </div>
               </button>
             ))}
             {privateRooms.length === 0 && (
                <div className="text-center py-6 text-slate-600 text-sm italic">
                    No active matches yet.
                </div>
             )}
           </div>
        </div>

        {/* Random Match Button */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/50">
           <button 
             onClick={handleFindMatch}
             disabled={isSearchingMatch}
             className={`w-full py-3 rounded-xl flex items-center justify-center gap-2 font-bold shadow-lg shadow-indigo-500/10 transition-all ${
               isSearchingMatch 
                ? 'bg-slate-800 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-indigo-600 to-indigo-500 hover:from-indigo-500 hover:to-indigo-400 text-white'
             }`}
           >
             {isSearchingMatch ? (
                <>
                   <Loader2 size={18} className="animate-spin" /> Searching...
                </>
             ) : (
                <>
                   <Zap size={18} fill="currentColor" /> Random 1-on-1
                </>
             )}
           </button>
        </div>
      </div>

      {/* --- ZONE B: CHAT ARENA --- */}
      <div className="flex-1 flex flex-col min-w-0 bg-slate-950/30 relative">
        
        {/* Header */}
        <div className="h-16 px-6 border-b border-slate-800 flex items-center justify-between bg-slate-900/50 backdrop-blur-md">
            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center">
                    {activeRoom?.type === 'public' ? <Hash size={20} className="text-slate-400" /> : <Zap size={20} className="text-yellow-400" />}
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white leading-tight">
                        {activeRoom?.type === 'public' ? activeRoom.name : 'Anonymous Match'}
                    </h2>
                    <p className="text-xs text-green-400 flex items-center gap-1">
                        <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse"></span>
                        {activeRoom?.type === 'public' ? `${onlineCount} students online` : 'Incognito Mode Active'}
                    </p>
                </div>
            </div>
            
            {/* Action Buttons */}
            <div className="flex items-center gap-2 text-slate-400">
               <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors"><Search size={20} /></button>
               <button className="p-2 hover:bg-slate-800 rounded-lg transition-colors md:hidden"><MoreVertical size={20} /></button>
            </div>
        </div>

        {/* Message Stream */}
        <div className="flex-1 overflow-y-auto p-6 space-y-1">
            {messages.length === 0 && (
                <div className="h-full flex flex-col items-center justify-center text-slate-500 opacity-60">
                    <MessageSquare size={48} className="mb-4 text-slate-700" />
                    <p>No messages yet. Be the first!</p>
                </div>
            )}
            
            {messages.map((msg, idx) => {
                const isMe = msg.user_id === currentUser?.id;
                const grouped = isMessageGrouped(idx);
                const showAvatar = !isMe && !grouped;
                const displayName = msg.is_anonymous 
                    ? (msg.fake_username || "Anonymous")
                    : (msg.profiles?.username || "Student");

                return (
                    <div key={msg.id} className={`flex gap-3 group ${isMe ? 'flex-row-reverse' : ''} ${grouped ? 'mt-1' : 'mt-6'}`}>
                        {/* Avatar */}
                        {!isMe && (
                             <div className="w-10 flex-shrink-0 flex flex-col items-center">
                                {showAvatar && (
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center overflow-hidden ${msg.is_anonymous ? 'bg-gradient-to-br from-slate-700 to-slate-800' : 'bg-indigo-900'}`}>
                                        {msg.profiles?.avatar_url && !msg.is_anonymous ? (
                                            <img src={msg.profiles.avatar_url} alt="Av" className="w-full h-full object-cover" />
                                        ) : (
                                            <User size={18} className="text-slate-400" />
                                        )}
                                    </div>
                                )}
                             </div>
                        )}
                        
                        {/* Bubble Area */}
                        <div className={`max-w-[70%] flex flex-col ${isMe ? 'items-end' : 'items-start'}`}>
                            {/* Name & Time Header (Only if not grouped) */}
                            {!grouped && (
                                <div className="flex items-center gap-2 mb-1 px-1">
                                    <span className={`text-sm font-bold ${msg.is_anonymous ? 'text-slate-300' : 'text-indigo-400'}`}>
                                        {displayName}
                                    </span>
                                    <span className="text-[10px] text-slate-600">
                                        {new Date(msg.created_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                    </span>
                                </div>
                            )}
                            
                            {/* The Bubble */}
                            <div className={`px-4 py-2.5 text-sm leading-relaxed shadow-sm transition-all relative group-hover:shadow-md ${
                                isMe 
                                 ? 'bg-indigo-600 text-white rounded-2xl rounded-tr-sm' 
                                 : 'bg-slate-800 text-slate-200 rounded-2xl rounded-tl-sm'
                            }`}>
                                {msg.content}
                            </div>
                        </div>
                    </div>
                );
            })}
            <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 bg-slate-900 border-t border-slate-800">
            <div className="max-w-4xl mx-auto relative flex items-end gap-2 bg-slate-800/50 p-2 rounded-xl border border-slate-700 focus-within:border-indigo-500/50 focus-within:bg-slate-800 transition-all">
                <button className="p-2 text-slate-400 hover:text-indigo-400 transition-colors">
                    <Smile size={24} />
                </button>
                <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            sendMessage();
                        }
                    }}
                    placeholder={`Message ${activeRoom?.name || 'Match'}...`}
                    className="flex-1 bg-transparent border-none focus:ring-0 text-slate-200 placeholder-slate-500 resize-none max-h-32 min-h-[44px] py-2.5 scrollbar-hide"
                    rows={1}
                />
                <button 
                    onClick={sendMessage}
                    disabled={!inputText.trim()}
                    className={`p-2 rounded-lg transition-all ${
                        inputText.trim() 
                        ? 'bg-indigo-600 text-white hover:bg-indigo-500 shadow-lg shadow-indigo-500/20' 
                        : 'bg-slate-700 text-slate-500 cursor-not-allowed'
                    }`}
                >
                    <Send size={20} />
                </button>
            </div>
            {activeRoom?.type === 'match' && (
                <div className="text-center mt-2">
                     <span className="text-xs text-slate-500">You are chatting anonymously. Messages are not linked to your profile.</span>
                </div>
            )}
        </div>
      </div>

      {/* --- ZONE C: CONTEXT PANEL (Desktop Only) --- */}
      <div className="w-64 bg-slate-900 border-l border-slate-800 hidden lg:flex flex-col p-6">
        {activeRoom?.type === 'public' ? (
            <>
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Room Info</h3>
                 <p className="text-sm text-slate-400 mb-6">This is a public broadcast channel for all VITAP students.</p>
                 
                 <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-4">Active Now</h3>
                 <div className="space-y-3">
                    {[1,2,3,4].map(i => (
                        <div key={i} className="flex items-center gap-3 opacity-60">
                            <div className="w-8 h-8 rounded-full bg-slate-700"></div>
                            <div className="h-2 w-24 bg-slate-800 rounded"></div>
                        </div>
                    ))}
                 </div>
            </>
        ) : (
            <>
                <div className="flex flex-col items-center mt-6">
                    <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-4 relative">
                        <Zap size={32} className="text-yellow-400" />
                        <span className="absolute bottom-0 right-0 w-4 h-4 bg-green-500 border-2 border-slate-900 rounded-full"></span>
                    </div>
                    <h3 className="font-bold text-white">Anonymous Match</h3>
                    <p className="text-xs text-slate-500 mt-1">Found via Queue</p>
                </div>
                
                <div className="mt-8 bg-indigo-900/20 rounded-xl p-4 border border-indigo-900/50">
                    <h4 className="text-xs font-bold text-indigo-400 mb-2">Compatibility</h4>
                    <p className="text-sm text-slate-300 leading-relaxed">
                        You both watched <span className="text-white font-medium">Inception</span> and <span className="text-white font-medium">The Boys</span>.
                    </p>
                </div>

                <div className="mt-auto">
                    <button className="w-full py-2 bg-slate-800 hover:bg-rose-900/30 hover:text-rose-400 text-slate-400 rounded-lg text-sm transition-colors border border-slate-700">
                        Report User
                    </button>
                </div>
            </>
        )}
      </div>

    </div>
  );
};

export default Chat;
