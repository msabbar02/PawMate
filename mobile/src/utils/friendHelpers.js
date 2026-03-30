import { supabase } from '../config/supabase';
import { createNotification } from './notificationHelpers';

/**
 * Send a friend request from current user to target user.
 */
export const sendFriendRequest = async (toUid, toName, fromUserData) => {
    const { data: { session } } = await supabase.auth.getSession();
    const currentUser = session?.user;
    if (!currentUser || toUid === currentUser.id) return;

    // Check if already friends
    const { data: friend } = await supabase
        .from('friends')
        .select('*')
        .eq('userId', currentUser.id)
        .eq('friendId', toUid)
        .maybeSingle();
    if (friend) throw new Error('already_friends');

    // Check for existing pending request
    const { data: existing } = await supabase
        .from('friendRequests')
        .select('*')
        .eq('fromUid', currentUser.id)
        .eq('toUid', toUid)
        .eq('status', 'pending');
    
    if (existing && existing.length > 0) throw new Error('already_sent');

    await supabase.from('friendRequests').insert({
        fromUid: currentUser.id,
        fromName: fromUserData?.fullName || 'Usuario',
        fromPhotoURL: fromUserData?.photoURL || null,
        toUid,
        toName,
        status: 'pending',
    });

    await createNotification(toUid, {
        type: 'friend_request',
        title: 'Solicitud de amistad 🤝',
        body: `${fromUserData?.fullName || 'Un usuario'} quiere ser tu amigo.`,
        fromUid: currentUser.id,
        icon: 'person-add-outline',
        iconBg: '#EFF6FF',
        iconColor: '#3B82F6',
    });
};

/**
 * Accept a friend request and add both users as friends.
 */
export const acceptFriendRequest = async (requestId, fromUid, fromName, fromPhotoURL, currentUserData) => {
    const { data: { session } } = await supabase.auth.getSession();
    const uid = session?.user?.id;
    if (!uid) return;

    // Add each user to the other's friends list (many-to-many relationship table)
    await supabase.from('friends').insert([
        { userId: uid, friendId: fromUid },
        { userId: fromUid, friendId: uid }
    ]);

    // Delete the friend request
    await supabase.from('friendRequests').delete().eq('id', requestId);

    // Notify the requester their request was accepted
    await createNotification(fromUid, {
        type: 'friend_accepted',
        title: '¡Solicitud aceptada! 🎉',
        body: `${currentUserData?.fullName || 'Un usuario'} aceptó tu solicitud de amistad.`,
        icon: 'people-outline',
        iconBg: '#E8F5EE',
        iconColor: '#1a7a4c',
    });
};

/**
 * Reject a friend request.
 */
export const rejectFriendRequest = async (requestId) => {
    await supabase.from('friendRequests').delete().eq('id', requestId);
};

/**
 * Remove a friend (both directions).
 */
export const removeFriend = async (uid1, uid2) => {
    await supabase.from('friends').delete().match({ userId: uid1, friendId: uid2 });
    await supabase.from('friends').delete().match({ userId: uid2, friendId: uid1 });
};

/**
 * Get list of friend UIDs for a user.
 */
export const getFriendIds = async (uid) => {
    const { data } = await supabase
        .from('friends')
        .select('friendId')
        .eq('userId', uid);
    
    return data ? data.map(d => d.friendId) : [];
};
