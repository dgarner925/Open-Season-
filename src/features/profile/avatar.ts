import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';

/**
 * Setting a profile photo.
 *
 * The phone hands back whatever the camera took -- routinely 12 megapixels and
 * several megabytes. Nothing on screen shows it larger than 72 points, so it
 * is squared and reduced to 512px before it ever leaves the device. That is
 * bandwidth on someone's truck signal, and storage you pay for, and neither is
 * worth spending on pixels no one will see.
 */
const EDGE = 512;

export const AVATAR_BUCKET = 'avatars';

export type AvatarPickResult = { ok: true } | { ok: false; reason: 'cancelled' | 'denied' | string };

async function squareTo512(uri: string): Promise<{ uri: string }> {
  // resize on the long edge, then centre-crop to a square
  const probe = await ImageManipulator.manipulateAsync(uri, [], {
    compress: 1,
    format: ImageManipulator.SaveFormat.JPEG,
  });
  const { width, height } = probe;
  const short = Math.min(width, height);
  const originX = Math.round((width - short) / 2);
  const originY = Math.round((height - short) / 2);
  const out = await ImageManipulator.manipulateAsync(
    uri,
    [
      { crop: { originX, originY, width: short, height: short } },
      { resize: { width: EDGE, height: EDGE } },
    ],
    { compress: 0.82, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: out.uri };
}

export function useSetAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (): Promise<AvatarPickResult> => {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) return { ok: false, reason: 'denied' };

      const picked = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        aspect: [1, 1],
        quality: 1,
        exif: false, // never upload where the photo was taken
      });
      if (picked.canceled || !picked.assets?.length) return { ok: false, reason: 'cancelled' };

      const { uri } = await squareTo512(picked.assets[0].uri);

      const { data: auth } = await supabase.auth.getUser();
      const uid = auth.user?.id;
      if (!uid) return { ok: false, reason: 'not signed in' };

      // One path per user, overwritten in place: the storage policy keys on
      // the first folder being the user's id, so nobody can write over
      // anyone else's face, and we never accumulate orphaned old photos.
      const path = `${uid}/avatar.jpg`;
      const body = await (await fetch(uri)).arrayBuffer();
      const { error: upErr } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(path, body, { contentType: 'image/jpeg', upsert: true });
      if (upErr) return { ok: false, reason: upErr.message };

      const { data: pub } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
      // Overwriting in place means the URL never changes, so a cache buster
      // is the only way the new face appears instead of the old one.
      const url = `${pub.publicUrl}?v=${Date.now()}`;

      const { error: rpcErr } = await supabase.rpc('set_avatar_url', { p_url: url });
      if (rpcErr) return { ok: false, reason: rpcErr.message };
      return { ok: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['party_roster'] });
      qc.invalidateQueries({ queryKey: ['party_thread'] });
    },
  });
}

export function useClearAvatar() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('set_avatar_url', { p_url: null });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['profile'] });
      qc.invalidateQueries({ queryKey: ['party_roster'] });
      qc.invalidateQueries({ queryKey: ['party_thread'] });
    },
  });
}
