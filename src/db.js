import { createClient } from '@supabase/supabase-js';

// The singleton supabase client
export let supabase = null;

// Persistent User State
export let currentUser = null;

export const hasSupabaseConfig = () => {
    return (import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_KEY) || 
           (localStorage.getItem('sb_url') && localStorage.getItem('sb_key'));
};

export const getSupabaseConfig = () => {
    return {
        url: import.meta.env.VITE_SUPABASE_URL || localStorage.getItem('sb_url'),
        key: import.meta.env.VITE_SUPABASE_KEY || localStorage.getItem('sb_key')
    };
};

export const saveSupabaseConfig = (url, key) => {
    localStorage.setItem('sb_url', url);
    localStorage.setItem('sb_key', key);
    initSupabase(url, key);
};

export const initSupabase = (url, key) => {
    supabase = createClient(url, key);
    return supabase;
};

// Simple pseudo-hash to securely scramble the minimum 4 char code
// Web Crypto API in browser
export const hashPassword = async (password) => {
    const msgUint8 = new TextEncoder().encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
};

export const loadCurrentUser = () => {
    const saved = localStorage.getItem('currentUser');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
        } catch (e) {
            currentUser = null;
        }
    }
    return currentUser;
};

export const setCurrentUser = (user) => {
    currentUser = user;
    if (user) {
        localStorage.setItem('currentUser', JSON.stringify(user));
    } else {
        localStorage.removeItem('currentUser');
    }
};

export const clearSupabaseConfig = () => {
    localStorage.removeItem('sb_url');
    localStorage.removeItem('sb_key');
    setCurrentUser(null);
    supabase = null;
};
