"use client";

import { Search, Send, Image, Smile, Phone, Video, Info, Loader2, MessageCircle } from "lucide-react";
import { useState, useEffect, useRef } from "react";
import toast from "react-hot-toast";
import EmojiPicker, { Theme } from "emoji-picker-react";

import { useSession } from "next-auth/react";

export default function MessagesPage() {
  const { data: session } = useSession();
  const currentUserId = (session?.user as any)?.id;
  
  const [contacts, setContacts] = useState<any[]>([]);
  const [activeContact, setActiveContact] = useState<any>(null);
  const [messages, setMessages] = useState<any[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const [isLoadingContacts, setIsLoadingContacts] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchContacts = async () => {
    try {
      const url = currentUserId ? `/api/messages/contacts?userId=${currentUserId}` : "/api/messages/contacts";
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setContacts(data.contacts);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingContacts(false);
    }
  };

  const fetchMessages = async (partnerId: string) => {
    if (!currentUserId) return;
    try {
      const res = await fetch(`/api/messages/${partnerId}?currentUserId=${currentUserId}`);
      if (res.ok) {
        const data = await res.json();
        setMessages(data);
        scrollToBottom();
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingMessages(false);
    }
  };

  // Initial fetch and polling for contacts
  useEffect(() => {
    fetchContacts();
    const interval = setInterval(fetchContacts, 5000); // Poll every 5s
    return () => clearInterval(interval);
  }, [currentUserId]);

  // Polling for messages when active contact changes
  useEffect(() => {
    if (activeContact) {
      setIsLoadingMessages(true);
      fetchMessages(activeContact.id);
      const interval = setInterval(() => fetchMessages(activeContact.id), 3000); // Poll every 3s
      return () => clearInterval(interval);
    }
  }, [activeContact, currentUserId]);

  const scrollToBottom = () => {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, 100);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !activeContact || !currentUserId) return;
    
    const msgData = {
      sender: currentUserId,
      receiver: activeContact.id,
      content: inputMessage.trim()
    };
    
    // Optimistic UI update
    const optimisticMsg = { ...msgData, _id: Date.now().toString(), createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, optimisticMsg]);
    setInputMessage("");
    scrollToBottom();

    try {
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgData)
      });
      if (!res.ok) throw new Error("Gửi lỗi");
      
      // Refresh to get actual DB record (handles IDs correctly)
      fetchMessages(activeContact.id);
      fetchContacts(); // Update last message in sidebar
    } catch (e) {
      toast.error("Không thể gửi tin nhắn");
      // Remove optimistic message on fail
      setMessages(prev => prev.filter(m => m._id !== optimisticMsg._id));
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeContact || !currentUserId) return;
    
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      
      const uploadRes = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });
      const uploadData = await uploadRes.json();
      
      if (!uploadRes.ok) throw new Error(uploadData.error);
      
      // Gửi tin nhắn với nội dung là URL ảnh
      const msgData = {
        sender: currentUserId,
        receiver: activeContact.id,
        content: `[IMAGE]${uploadData.url}`
      };
      
      const res = await fetch("/api/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(msgData)
      });
      if (!res.ok) throw new Error("Gửi lỗi");
      
      fetchMessages(activeContact.id);
      fetchContacts();
    } catch (err: any) {
      toast.error(err.message || "Lỗi khi tải ảnh lên");
    } finally {
      setIsUploading(false);
      // Reset input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const insertEmoji = (emojiObject: any) => {
    setInputMessage(prev => prev + emojiObject.emoji);
    setShowEmojiPicker(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <div className="h-[calc(100vh-140px)] flex flex-col md:flex-row bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      
      {/* Cột Danh sách Chat (Sidebar) */}
      <div className="w-full md:w-80 border-r border-slate-200 flex flex-col">
        <div className="p-4 border-b border-slate-100">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Tin nhắn nội bộ</h2>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Tìm kiếm đồng nghiệp..." 
              className="w-full pl-9 pr-4 py-2 border-none bg-slate-100 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 transition" 
            />
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto">
          {isLoadingContacts && contacts.length === 0 ? (
            <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" /></div>
          ) : contacts.map((contact) => (
            <div 
              key={contact.id} 
              onClick={() => setActiveContact(contact)}
              className={`p-4 flex items-center gap-3 cursor-pointer transition ${activeContact?.id === contact.id ? "bg-indigo-50" : "hover:bg-slate-50"}`}
            >
              <div className="relative">
                <div className="w-12 h-12 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-lg">
                  {contact.avatar}
                </div>
                {contact.online && (
                  <span className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 border-2 border-white rounded-full"></span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <h3 className="font-semibold text-slate-800 truncate">{contact.name}</h3>
                  <span className="text-xs text-slate-500 whitespace-nowrap ml-2">{contact.time}</span>
                </div>
                <div className="flex justify-between items-center">
                  <p className={`text-sm truncate ${contact.unread > 0 ? "text-slate-900 font-medium" : "text-slate-500"}`}>
                    {contact.lastMessage}
                  </p>
                  {contact.unread > 0 && (
                    <span className="w-5 h-5 bg-indigo-600 text-white text-xs font-bold rounded-full flex items-center justify-center ml-2">
                      {contact.unread}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Cột Nội dung Chat */}
      <div className="flex-1 flex flex-col bg-slate-50/30">
        {!activeContact ? (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400">
            <MessageCircle size={48} className="mb-4 opacity-50" />
            <p>Chọn một liên hệ để bắt đầu trò chuyện</p>
          </div>
        ) : (
          <>
            {/* Header Chat */}
            <div className="h-16 px-6 border-b border-slate-200 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold">
                  {activeContact.avatar}
                </div>
                <div>
                  <h3 className="font-bold text-slate-800">{activeContact.name}</h3>
                  <p className="text-xs text-emerald-600 font-medium">Đang hoạt động</p>
                </div>
              </div>
              <div className="flex gap-4 text-slate-400">
                <button className="hover:text-indigo-600 transition"><Phone size={20} /></button>
                <button className="hover:text-indigo-600 transition"><Video size={20} /></button>
                <button className="hover:text-indigo-600 transition"><Info size={20} /></button>
              </div>
            </div>

            {/* Khung Chat (Messages) */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {isLoadingMessages && messages.length === 0 ? (
                <div className="flex justify-center py-8 text-slate-400"><Loader2 className="animate-spin" /></div>
              ) : messages.map((msg, index) => {
                const isMine = msg.sender === currentUserId;
                const showDate = index === 0 || new Date(messages[index - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();
                
                return (
                  <div key={msg._id}>
                    {showDate && (
                      <div className="flex justify-center my-4">
                        <span className="text-xs font-medium text-slate-400 bg-slate-100 px-3 py-1 rounded-full">
                          {new Date(msg.createdAt).toLocaleDateString('vi-VN')}
                        </span>
                      </div>
                    )}
                    <div className={`flex gap-3 ${isMine ? "flex-row-reverse" : ""}`}>
                      {!isMine && (
                        <div className="w-8 h-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm shrink-0">
                          {activeContact.avatar}
                        </div>
                      )}
                      <div className={`${isMine ? "bg-indigo-600 text-white rounded-tr-none" : "bg-white border border-slate-200 text-slate-700 rounded-tl-none"} p-3 rounded-2xl shadow-sm max-w-[70%]`}>
                        {msg.content.startsWith('[IMAGE]') ? (
                          <img src={msg.content.replace('[IMAGE]', '')} alt="Chat image" className="rounded-lg max-h-48 object-cover cursor-pointer hover:opacity-90 transition" onClick={() => window.open(msg.content.replace('[IMAGE]', ''), '_blank')} />
                        ) : (
                          <p className="text-sm break-words whitespace-pre-wrap">{msg.content}</p>
                        )}
                        <span className={`text-[10px] mt-1 block ${isMine ? "text-indigo-200 text-right" : "text-slate-400"}`}>
                          {new Date(msg.createdAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Khung nhập tin nhắn */}
            <div className="p-4 bg-white border-t border-slate-200 relative">
              {/* Emoji Picker Popover */}
              {showEmojiPicker && (
                <div className="absolute bottom-full left-4 mb-2 z-10 shadow-xl rounded-xl overflow-hidden">
                  <EmojiPicker 
                    onEmojiClick={insertEmoji} 
                    autoFocusSearch={false}
                    theme={Theme.LIGHT}
                    searchPlaceHolder="Tìm kiếm emoji..."
                  />
                </div>
              )}
              
              <div className="flex items-end gap-2 bg-slate-50 border border-slate-200 rounded-2xl p-2 focus-within:ring-2 focus-within:ring-indigo-500 focus-within:border-indigo-500 transition">
                <button 
                  onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                  className={`p-2 transition shrink-0 ${showEmojiPicker ? "text-indigo-600" : "text-slate-400 hover:text-indigo-600"}`}
                >
                  <Smile size={20} />
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  onChange={handleImageUpload} 
                  accept="image/*" 
                  className="hidden" 
                />
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                  className="p-2 text-slate-400 hover:text-indigo-600 transition shrink-0 disabled:opacity-50"
                  title="Gửi hình ảnh"
                >
                  {isUploading ? <Loader2 size={20} className="animate-spin" /> : <Image size={20} />}
                </button>
                <textarea 
                  rows={1}
                  placeholder="Nhập tin nhắn..." 
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  onKeyDown={handleKeyDown}
                  className="flex-1 bg-transparent border-none focus:ring-0 text-sm py-2 resize-none max-h-32"
                ></textarea>
                <button 
                  onClick={handleSendMessage}
                  disabled={!inputMessage.trim()}
                  className="p-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shrink-0 shadow-sm disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
