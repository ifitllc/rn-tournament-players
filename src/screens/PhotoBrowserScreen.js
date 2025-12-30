import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as FileSystem from 'expo-file-system/legacy';
import { listLocalPhotos, clearLocalPhotos } from '../storage/photoStore.js';

export default function PhotoBrowserScreen({ onClose, onCleared = () => {} }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);
  const [clearing, setClearing] = useState(false);
  const [deletingEmpty, setDeletingEmpty] = useState(false);

  useEffect(() => {
    loadPhotos();
  }, []);

  async function loadPhotos() {
    try {
      setLoading(true);
      const photoFiles = await listLocalPhotos();
      console.log('Photo Browser: Found photos:', photoFiles.length);
      photoFiles.forEach((path, idx) => {
        console.log(`  ${idx + 1}. ${path}`);
      });
      setPhotos(photoFiles);
    } catch (error) {
      console.error('Failed to load photos:', error);
      Alert.alert('Error', 'Failed to load photos: ' + error.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleClearPhotos() {
    Alert.alert(
      'Clear Local Photos',
      'This deletes all cached photos on this device. Remote copies stay in Supabase.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              setClearing(true);
              await clearLocalPhotos();
              await loadPhotos();
              onCleared();
              Alert.alert('Cleared', 'Local photos removed on this device.');
            } catch (err) {
              console.error('Failed to clear photos:', err);
              Alert.alert('Error', 'Failed to clear local photos: ' + err.message);
            } finally {
              setClearing(false);
            }
          },
        },
      ]
    );
  }

  async function handleDeleteEmpty() {
    if (photos.length === 0) return;
    setDeletingEmpty(true);
    try {
      const infos = await Promise.all(
        photos.map(async (p) => {
          const info = await FileSystem.getInfoAsync(p);
          return { path: p, exists: info.exists, size: info.size || 0, isDir: info.isDirectory };
        })
      );
      const empties = infos
        .filter((i) => !i.exists || i.isDir || i.size <= 512) // treat missing, directories, or tiny files as empty/corrupt
        .map((i) => i.path);
      if (empties.length === 0) {
        Alert.alert('No empty files', 'Did not find any zero-byte or tiny files.');
        return;
      }
      await Promise.all(empties.map((p) => FileSystem.deleteAsync(p, { idempotent: true })));
      await loadPhotos();
      onCleared();
      Alert.alert('Deleted', `Removed ${empties.length} empty photos.`);
    } catch (err) {
      console.error('Failed to delete empty photos:', err);
      Alert.alert('Error', 'Failed to delete empty photos: ' + err.message);
    } finally {
      setDeletingEmpty(false);
    }
  }

  function renderPhoto({ item }) {
    const fileName = item.split('/').pop();
    return (
      <Pressable 
        style={styles.photoCard} 
        onPress={() => setSelectedPhoto(item)}
      >
        <Image 
          source={{ uri: item }} 
          style={styles.thumbnail}
          onError={(e) => console.log('Image load error:', fileName, e.nativeEvent.error)}
          onLoad={() => console.log('Image loaded successfully:', fileName)}
        />
        <Text style={styles.fileName} numberOfLines={2}>{fileName}</Text>
      </Pressable>
    );
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
        <View style={styles.header}>
          <Text style={styles.title}>Photo Browser</Text>
          <Pressable onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </Pressable>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#2563eb" />
          <Text style={styles.loadingText}>Loading photos...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <Text style={styles.title}>Photo Browser ({photos.length})</Text>
        <Pressable onPress={onClose} style={styles.closeButton}>
          <Text style={styles.closeButtonText}>✕</Text>
        </Pressable>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.toolbarRow}>
          <Pressable style={[styles.toolbarButton, clearing && styles.toolbarButtonDisabled]} onPress={handleClearPhotos} disabled={clearing}>
            <Text style={styles.toolbarButtonText}>{clearing ? 'Clearing…' : 'Delete All'}</Text>
          </Pressable>
          <Pressable style={[styles.toolbarButton, deletingEmpty && styles.toolbarButtonDisabled]} onPress={handleDeleteEmpty} disabled={deletingEmpty}>
            <Text style={styles.toolbarButtonText}>{deletingEmpty ? 'Deleting…' : 'Delete Empty'}</Text>
          </Pressable>
        </View>
      </View>

      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos found</Text>
          <Text style={styles.emptySubtext}>Sync with Supabase or capture new photos</Text>
        </View>
      ) : (
        <FlatList
          data={photos}
          renderItem={renderPhoto}
          keyExtractor={(item) => item}
          numColumns={3}
          contentContainerStyle={styles.grid}
        />
      )}

      {selectedPhoto && (
        <Pressable 
          style={styles.fullscreenOverlay} 
          onPress={() => setSelectedPhoto(null)}
        >
          <View style={styles.fullscreenContainer}>
            <Image 
              source={{ uri: selectedPhoto }} 
              style={styles.fullscreenImage}
              resizeMode="contain"
            />
            <Text style={styles.fullscreenFileName}>
              {selectedPhoto.split('/').pop()}
            </Text>
          </View>
        </Pressable>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 35,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    color: '#94a3b8',
    marginTop: 12,
    fontSize: 16,
  },
  toolbar: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  toolbarRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toolbarButton: {
    backgroundColor: '#334155',
    paddingVertical: 10,
    borderRadius: 8,
    alignItems: 'center',
    flex: 1,
  },
  toolbarButtonDisabled: {
    backgroundColor: '#1f2937',
  },
  toolbarButtonText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 14,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
  },
  emptyText: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
  },
  grid: {
    padding: 8,
  },
  photoCard: {
    flex: 1,
    margin: 4,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    overflow: 'hidden',
    aspectRatio: 1,
  },
  thumbnail: {
    width: '100%',
    height: '80%',
    backgroundColor: '#0f172a',
  },
  fileName: {
    color: '#94a3b8',
    fontSize: 10,
    padding: 4,
    textAlign: 'center',
  },
  fullscreenOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenContainer: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  fullscreenImage: {
    width: '90%',
    height: '80%',
  },
  fullscreenFileName: {
    color: '#e2e8f0',
    fontSize: 14,
    marginTop: 16,
    paddingHorizontal: 16,
    textAlign: 'center',
  },
});
