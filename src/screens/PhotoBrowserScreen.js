import React, { useEffect, useState } from 'react';
import { View, Text, FlatList, Image, StyleSheet, Pressable, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { listLocalPhotos } from '../storage/photoStore.js';

export default function PhotoBrowserScreen({ onClose }) {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPhoto, setSelectedPhoto] = useState(null);

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

      {photos.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No photos found</Text>
          <Text style={styles.emptySubtext}>Download photos from Google Drive or capture new ones</Text>
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
