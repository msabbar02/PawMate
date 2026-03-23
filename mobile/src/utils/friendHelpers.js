import { db, auth } from '../config/firebase';
import {
    collection, addDoc, doc, getDoc, getDocs,
    deleteDoc, serverTimestamp, query, where, setDoc
} from 'firebase/firestore';
import { createNotification } from './notificationHelpers';

/**
 * Send a friend request from current user to target user.
 */
export const sendFriendRequest = async (toUid, toName, fromUserData) => {
    if (!auth.currentUser || toUid === auth.currentUser.uid) return;

    // Check if already friends
    const friendDoc = await getDoc(doc(db, 'users', auth.currentUser.uid, 'friends', toUid));
    if (friendDoc.exists()) throw new Error('already_friends');

    // Check for existing pending request
    const existing = await getDocs(query(
        collection(db, 'friendRequests'),
        where('fromUid', '==', auth.currentUser.uid),
        where('toUid', '==', toUid),
        where('status', '==', 'pending')
    ));
    if (!existing.empty) throw new Error('already_sent');

    await addDoc(collection(db, 'friendRequests'), {
        fromUid: auth.currentUser.uid,
        fromName: fromUserData?.fullName || 'Usuario',
        fromPhotoURL: fromUserData?.photoURL || null,
        toUid,
        toName,
        status: 'pending',
        createdAt: serverTimestamp(),
    });

    await createNotification(toUid, {
        type: 'friend_request',
        title: 'Solicitud de amistad 🤝',
        body: `${fromUserData?.fullName || 'Un usuario'} quiere ser tu amigo.`,
        fromUid: auth.currentUser.uid,
        icon: 'person-add-outline',
        iconBg: '#EFF6FF',
        iconColor: '#3B82F6',
    });
};

/**
 * Accept a friend request and add both users as friends.
 */
export const acceptFriendRequest = async (requestId, fromUid, fromName, fromPhotoURL, currentUserData) => {
    const uid = auth.currentUser?.uid;
    if (!uid) return;

    // Add each user to the other's friends subcollection
    await setDoc(doc(db, 'users', uid, 'friends', fromUid), {
        friendUid: fromUid,
        friendName: fromName,
        friendPhotoURL: fromPhotoURL || null,
        addedAt: serverTimestamp(),
    });

    await setDoc(doc(db, 'users', fromUid, 'friends', uid), {
        friendUid: uid,
        friendName: currentUserData?.fullName || 'Usuario',
        friendPhotoURL: currentUserData?.photoURL || null,
        addedAt: serverTimestamp(),
    });

    // Delete the friend request
    await deleteDoc(doc(db, 'friendRequests', requestId));

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
    await deleteDoc(doc(db, 'friendRequests', requestId));
};

/**
 * Remove a friend (both directions).
 */
export const removeFriend = async (uid1, uid2) => {
    await deleteDoc(doc(db, 'users', uid1, 'friends', uid2));
    await deleteDoc(doc(db, 'users', uid2, 'friends', uid1));
};

/**
 * Get list of friend UIDs for a user.
 */
export const getFriendIds = async (uid) => {
    const snap = await getDocs(collection(db, 'users', uid, 'friends'));
    return snap.docs.map(d => d.id);
};
