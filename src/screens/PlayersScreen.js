import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Keyboard, Modal, Pressable, StyleSheet, Text, TextInput, View, Dimensions, Animated, PanResponder, Alert } from 'react-native';
import { CameraView, useCameraPermissions } from 'expo-camera';
import * as ImageManipulator from 'expo-image-manipulator';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getPlayers, getTournaments } from '../services/omnipongService.js';
import { composeImageFileName } from '../helpers/utils.js';
import { getActiveTournamentName } from '../helpers/utils.js';
import { photoExists, savePhoto } from '../storage/photoStore.js';
import useBackgroundSync from '../hooks/useBackgroundSync.js';
import { uploadAllPhotos, uploadSinglePhoto, hasSupabaseConfig } from '../services/supabaseService.js';
import SettingsScreen from './SettingsScreen.js';
import PhotoBrowserScreen from './PhotoBrowserScreen.js';

const SCREEN_WIDTH = Dimensions.get('window').width;
const SELECTED_TOURNAMENT_KEY = '@selected_tournament';
const MANUAL_PLAYERS_KEY = '@manual_players';

export default function PlayersScreen() {
  const [loading, setLoading] = useState(true);
  const [players, setPlayers] = useState([]);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState(null);
  const [selectedPhotoUri, setSelectedPhotoUri] = useState(null);
  const [playerPhotos, setPlayerPhotos] = useState({});
  const [cameraVisible, setCameraVisible] = useState(false);
  const [cameraType, setCameraType] = useState('back');
  const [capturedUri, setCapturedUri] = useState(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [cameraPermission, requestCameraPermission] = useCameraPermissions();
  const [showSettings, setShowSettings] = useState(false);
  const [showPhotoBrowser, setShowPhotoBrowser] = useState(false);

  const cameraRef = useRef(null);
  const translateX = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(0)).current;
  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gestureState) => {
        translateX.setValue(gestureState.dx);
        translateY.setValue(gestureState.dy);
      },
      onPanResponderRelease: (_, gestureState) => {
        const cropSize = SCREEN_WIDTH - 64;
        const displayWidth = SCREEN_WIDTH - 32;
        const aspectRatio = imageSize.current.width / imageSize.current.height;
        const displayHeight = displayWidth / aspectRatio;
        
        const newX = Math.max(0, Math.min(gestureState.dx + cropPositionRef.current.x, displayWidth - cropSize));
        const newY = Math.max(0, Math.min(gestureState.dy + cropPositionRef.current.y, displayHeight - cropSize));
        
        setCropPosition({ x: newX, y: newY });
        cropPositionRef.current = { x: newX, y: newY };
        translateX.setValue(0);
        translateY.setValue(0);
      },
    })
  ).current;
  const cropPositionRef = useRef({ x: 0, y: 0 });
  const imageSize = useRef({ width: 0, height: 0 });
  const { syncOnce } = useBackgroundSync(uploadSinglePhoto);

  useEffect(() => {
    loadPlayers();
  }, []);

  useEffect(() => {
    if (!selected) return;
    (async () => {
      const uri = await photoExists(selected.name);
      setSelectedPhotoUri(uri);
    })();
  }, [selected]);

  // Load photos for all players
  useEffect(() => {
    if (players.length === 0) return;
    console.log('PlayersScreen: Loading photos for', players.length, 'players');
    (async () => {
      const photos = {};
      for (const player of players) {
        const uri = await photoExists(player.name);
        if (uri) {
          console.log('  ✓ Found photo for:', player.name, '→', uri);
          photos[player.name] = uri;
        } else {
          console.log('  ✗ No photo for:', player.name);
        }
      }
      console.log('PlayersScreen: Loaded', Object.keys(photos).length, 'photos');
      setPlayerPhotos(photos);
    })();
  }, [players]);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return players;
    return players.filter((p) => p.name.toLowerCase().includes(term));
  }, [players, search]);

  async function loadPlayers() {
    try {
      setLoading(true);
      
      // Get selected tournament from settings
      const selectedTournamentData = await AsyncStorage.getItem(SELECTED_TOURNAMENT_KEY);
      let selectedTournament = null;
      
      if (selectedTournamentData) {
        selectedTournament = JSON.parse(selectedTournamentData);
      }
      
      // Load omnipong players
      let omnipongPlayers = [];
      if (selectedTournament) {
        // Use the selected tournament
        omnipongPlayers = await getPlayers(selectedTournament.omnipongUrl);
      } else {
        // Fall back to auto-detection
        const tournaments = await getTournaments();
        if (tournaments.length > 0) {
          const activeName = getActiveTournamentName();
          const tourney = tournaments.find((t) => t.name.includes(activeName)) || tournaments[0];
          omnipongPlayers = await getPlayers(tourney.omnipongUrl);
        }
      }
      
      // Load manual players
      const manualPlayersData = await AsyncStorage.getItem(MANUAL_PLAYERS_KEY);
      let manualPlayers = [];
      if (manualPlayersData) {
        manualPlayers = JSON.parse(manualPlayersData);
      }
      
      // Merge players (manual players first, then omnipong)
      const merged = [...manualPlayers, ...omnipongPlayers];
      setPlayers(merged);
    } catch (err) {
      console.error('Failed to load players', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function openCameraFor(player) {
    setSelected(player);
    const perm = await ensureCameraPermission();
    if (!perm) {
      console.error('Camera permission denied');
      return;
    }
    setCameraVisible(true);
  }

  async function handleCapture() {
    if (!cameraRef.current) return;
    const perm = await ensureCameraPermission();
    if (!perm) return;

    try {
      const raw = await cameraRef.current.takePictureAsync({ quality: 0.8, skipProcessing: true });
      setCameraVisible(false);
      
      // Get image dimensions
      Image.getSize(raw.uri, (width, height) => {
        imageSize.current = { width, height };
        setCapturedUri(raw.uri);
        // Center the crop box initially
        const cropSize = SCREEN_WIDTH - 64;
        const displayWidth = SCREEN_WIDTH - 32;
        const aspectRatio = width / height;
        const displayHeight = displayWidth / aspectRatio;
        const initialX = (displayWidth - cropSize) / 2;
        const initialY = (displayHeight - cropSize) / 2;
        setCropPosition({ x: initialX, y: initialY });
        cropPositionRef.current = { x: initialX, y: initialY };
        translateX.setValue(0);
        translateY.setValue(0);
      });
    } catch (err) {
      console.error('Capture failed', err.message);
    }
  }

  async function handleCropConfirm() {
    if (!capturedUri || !selected) return;
    
    try {
      // Calculate crop based on dragged position
      const cropSize = SCREEN_WIDTH - 64;
      const displayWidth = SCREEN_WIDTH - 32;
      const aspectRatio = imageSize.current.width / imageSize.current.height;
      const displayHeight = displayWidth / aspectRatio;
      
      // Convert screen coordinates to image coordinates
      const scaleX = imageSize.current.width / displayWidth;
      const scaleY = imageSize.current.height / displayHeight;
      
      const originX = Math.max(0, Math.min(cropPosition.x * scaleX, imageSize.current.width - cropSize * scaleX));
      const originY = Math.max(0, Math.min(cropPosition.y * scaleY, imageSize.current.height - cropSize * scaleY));
      const size = cropSize * scaleX;
      
      const cropped = await ImageManipulator.manipulateAsync(
        capturedUri,
        [
          {
            crop: {
              originX,
              originY,
              width: size,
              height: size,
            },
          },
        ],
        { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
      );
      
      const savedPath = await savePhoto(selected.name, cropped.uri);
      setSelectedPhotoUri(savedPath);
      setCapturedUri(null);
      await syncOnce();
    } catch (err) {
      console.error('Crop failed', err.message);
    }
  }

  function handleCropCancel() {
    setCapturedUri(null);
  }

  async function ensureCameraPermission() {
    if (cameraPermission?.granted) return true;
    const req = await requestCameraPermission();
    return req.granted;
  }

  async function handleRotatePhoto() {
    if (!selectedPhotoUri || !selected) return;
    
    try {
      // Rotate the photo 90 degrees clockwise
      const rotated = await ImageManipulator.manipulateAsync(
        selectedPhotoUri,
        [{ rotate: 90 }],
        { compress: 0.9, format: ImageManipulator.SaveFormat.PNG }
      );
      
      // Save the rotated photo (replaces the original)
      const savedPath = await savePhoto(selected.name, rotated.uri);
      setSelectedPhotoUri(savedPath);
      
      // Update the playerPhotos cache to trigger re-render in list
      setPlayerPhotos(prev => ({
        ...prev,
        [selected.name]: savedPath
      }));
      
      console.log('Photo rotated and saved:', savedPath);
    } catch (err) {
      console.error('Rotate failed', err.message);
    }
  }

  async function handleSyncNow() {
    try {
      if (!hasSupabaseConfig()) {
        Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then reload the app.');
        return;
      }
      console.log('Starting manual sync...');
      await uploadAllPhotos();
      console.log('Sync completed successfully');
    } catch (err) {
      console.error('Sync failed:', err.message);
    }
  }

  function renderPlayer({ item }) {
    const hasPhoto = playerPhotos[item.name];
    return (
      <Pressable style={styles.playerRow} onPress={() => {
        Keyboard.dismiss();
        setSelected(item);
      }}>
        {hasPhoto && (
          <Image source={{ uri: hasPhoto }} style={styles.playerThumbnail} />
        )}
        <Text style={[styles.playerName, hasPhoto && styles.playerNameWithPhoto]}>
          {item.name}
        </Text>
        {hasPhoto && <Text style={styles.photoIndicator}>📷</Text>}
      </Pressable>
    );
  }

  return (
    <View style={styles.container}>
      {showSettings ? (
        <SettingsScreen onBack={() => {
          setShowSettings(false);
          loadPlayers(); // Reload players when returning from settings
        }} />
      ) : (
        <>
          <View style={styles.headerRow}>
            <Text style={styles.title}>Tournament Players</Text>
            <View style={styles.headerButtons}>
              <Pressable style={styles.headerButton} onPress={() => setShowPhotoBrowser(true)}>
                <Text style={styles.headerButtonText}>🖼️</Text>
              </Pressable>
              <Pressable style={styles.headerButton} onPress={() => setShowSettings(true)}>
                <Text style={styles.headerButtonText}>⚙️</Text>
              </Pressable>
            </View>
          </View>

          <View style={styles.countRow}>
            <Text style={styles.countText}>
              {filtered.length} {filtered.length === 1 ? 'player' : 'players'}
              {search && players.length !== filtered.length && ` (${players.length} total)`}
            </Text>
          </View>

          <TextInput
            placeholder="Search players"
            placeholderTextColor="#94a3b8"
            value={search}
            onChangeText={setSearch}
            onBlur={() => Keyboard.dismiss()}
            style={styles.search}
          />

          {loading ? (
            <ActivityIndicator color="#38bdf8" style={{ marginTop: 24 }} />
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={(item) => String(item.id)}
              renderItem={renderPlayer}
              style={styles.list}
              keyboardShouldPersistTaps="handled"
            />
          )}

          {selected && (
            <View style={styles.detailCard}>
              <View style={styles.detailHeader}>
                <Text style={styles.detailTitle}>{selected.name}</Text>
                <Pressable style={styles.closeButton} onPress={() => setSelected(null)}>
                  <Text style={styles.closeButtonText}>✕</Text>
                </Pressable>
              </View>
              {selectedPhotoUri ? (
                <Image source={{ uri: selectedPhotoUri }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.photoPlaceholder]}>
                  <Text style={styles.placeholderText}>No photo</Text>
                </View>
              )}
              <View style={styles.actions}>
                <Pressable style={styles.button} onPress={() => openCameraFor(selected)}>
                  <Text style={styles.buttonText}>{selectedPhotoUri ? 'Retake Photo' : 'Take Photo'}</Text>
                </Pressable>
                {selectedPhotoUri && (
                  <Pressable style={[styles.button, styles.rotateButton]} onPress={handleRotatePhoto}>
                    <Text style={styles.buttonText}>🔄 Rotate</Text>
                  </Pressable>
                )}
                <Pressable style={[styles.button, styles.secondary]} onPress={handleSyncNow}>
                  <Text style={styles.buttonText}>Sync Now</Text>
                </Pressable>
              </View>
            </View>
          )}

          <Modal visible={showPhotoBrowser} animationType="slide" onRequestClose={() => setShowPhotoBrowser(false)}>
            <PhotoBrowserScreen onClose={() => setShowPhotoBrowser(false)} />
          </Modal>

          <Modal visible={cameraVisible} animationType="slide">
            <View style={styles.cameraContainer}>
              <CameraView style={styles.camera} facing={cameraType} ref={cameraRef}>
                <View style={styles.cameraControls}>
                  <Pressable style={styles.iconButton} onPress={() => setCameraType((t) => (t === 'back' ? 'front' : 'back'))}>
                    <Text style={styles.buttonText}>Flip</Text>
                  </Pressable>
                  <Pressable style={styles.iconButton} onPress={() => setCameraVisible(false)}>
                    <Text style={styles.buttonText}>Close</Text>
                  </Pressable>
                </View>
              </CameraView>
              <Pressable style={styles.capture} onPress={handleCapture}>
                <Text style={styles.captureText}>Capture</Text>
              </Pressable>
            </View>
          </Modal>

          <Modal visible={!!capturedUri} animationType="slide">
        <View style={styles.cropContainer}>
          <Text style={styles.cropTitle}>Drag to Adjust Crop</Text>
          <View style={styles.cropPreview}>
            {capturedUri && (
              <Image 
                source={{ uri: capturedUri }} 
                style={styles.cropImage}
                resizeMode="contain"
              />
            )}
            <View style={styles.cropOverlay}>
              <Animated.View 
                {...panResponder.panHandlers}
                style={[
                  styles.cropBox,
                  {
                    transform: [
                      { translateX },
                      { translateY },
                    ],
                    left: cropPosition.x,
                    top: cropPosition.y,
                  },
                ]}
              >
                <View style={styles.dragHandle} />
              </Animated.View>
            </View>
          </View>
          <Text style={styles.cropHint}>Drag the box to adjust crop area</Text>
          <View style={styles.cropActions}>
            <Pressable style={[styles.button, styles.cancelButton]} onPress={handleCropCancel}>
              <Text style={styles.buttonText}>Cancel</Text>
            </Pressable>
            <Pressable style={[styles.button, styles.confirmButton]} onPress={handleCropConfirm}>
              <Text style={styles.buttonText}>Use Photo</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    flex: 1, 
    backgroundColor: '#0f172a', 
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
    marginTop: 16,
  },
  title: { color: '#e2e8f0', fontSize: 24, fontWeight: '700' },
  headerButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
  },
  headerButtonText: {
    fontSize: 20,
  },
  settingsButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 20,
  },
  settingsButtonText: {
    fontSize: 20,
  },
  countRow: {
    marginBottom: 8,
  },
  countText: {
    color: '#94a3b8',
    fontSize: 14,
  },
  search: {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  list: { marginTop: 12 },
  playerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderBottomWidth: 1,
    borderColor: '#1e293b',
  },
  playerThumbnail: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
    backgroundColor: '#1e293b',
  },
  playerName: { color: '#e2e8f0', fontSize: 16 },
  playerNameWithPhoto: { flex: 1 },
  photoIndicator: {
    color: '#64748b',
    fontSize: 16,
    marginLeft: 8,
  },
  detailCard: {
    marginTop: 12,
    backgroundColor: '#111827',
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: '#1f2937',
  },
  detailTitle: { color: '#e2e8f0', fontSize: 18, fontWeight: '700' },
  detailHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#1e293b',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
  },
  photo: { width: '100%', aspectRatio: 1, borderRadius: 12, backgroundColor: '#0f172a' },
  photoPlaceholder: { justifyContent: 'center', alignItems: 'center' },
  placeholderText: { color: '#64748b' },
  actions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  button: { flex: 1, backgroundColor: '#2563eb', paddingVertical: 12, borderRadius: 10, alignItems: 'center' },
  secondary: { backgroundColor: '#334155' },
  rotateButton: { backgroundColor: '#8b5cf6' },
  buttonText: { color: '#e2e8f0', fontWeight: '600' },
  cameraContainer: { flex: 1, backgroundColor: '#000' },
  camera: { flex: 1 },
  cameraControls: {
    position: 'absolute',
    bottom: 24,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
  },
  iconButton: {
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  capture: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    paddingBottom: 34,
    alignItems: 'center',
  },
  captureText: { color: '#e2e8f0', fontWeight: '700', fontSize: 16 },
  cropContainer: {
    flex: 1,
    backgroundColor: '#0f172a',
    padding: 16,
  },
  cropTitle: {
    color: '#e2e8f0',
    fontSize: 20,
    fontWeight: '700',
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 16,
  },
  cropPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  cropImage: {
    width: '100%',
    height: '100%',
  },
  cropOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  cropBox: {
    position: 'absolute',
    width: SCREEN_WIDTH - 64,
    height: SCREEN_WIDTH - 64,
    borderWidth: 3,
    borderColor: '#38bdf8',
    borderRadius: 8,
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
  },
  dragHandle: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: 40,
    height: 40,
    marginLeft: -20,
    marginTop: -20,
    backgroundColor: 'rgba(56, 189, 248, 0.3)',
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#38bdf8',
  },
  cropHint: {
    color: '#94a3b8',
    textAlign: 'center',
    marginVertical: 12,
    fontSize: 14,
  },
  cropActions: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 40,
    paddingBottom: 20,
  },
  cancelButton: {
    backgroundColor: '#64748b',
  },
  confirmButton: {
    backgroundColor: '#10b981',
  },
});
