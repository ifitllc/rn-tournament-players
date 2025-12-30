import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View, Alert, Modal } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTournaments, getPlayers } from '../services/omnipongService.js';
import { downloadMissingPhotos, uploadAllPhotos, hasSupabaseConfig } from '../services/supabaseService.js';
import { listLocalPhotos, getPendingUploads } from '../storage/photoStore.js';
import PhotoBrowserScreen from './PhotoBrowserScreen.js';

const SELECTED_TOURNAMENT_KEY = '@selected_tournament';
const MANUAL_PLAYERS_KEY = '@manual_players';

export default function SettingsScreen({ onBack }) {
  const [tournaments, setTournaments] = useState([]);
  const [selectedTournament, setSelectedTournament] = useState(null);
  const [loading, setLoading] = useState(true);
  const [manualPlayers, setManualPlayers] = useState([]);
  const [newPlayerName, setNewPlayerName] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState('');
  const [downloadingPlayers, setDownloadingPlayers] = useState(false);
  const [localPhotoCount, setLocalPhotoCount] = useState(0);
  const [pendingUploadCount, setPendingUploadCount] = useState(0);
  const [tournamentSectionExpanded, setTournamentSectionExpanded] = useState(false);
  const [storageSectionExpanded, setStorageSectionExpanded] = useState(false);
  const supabaseReady = hasSupabaseConfig();
  const [showPhotoBrowser, setShowPhotoBrowser] = useState(false);

  useEffect(() => {
    loadSettings();
    loadPhotoStats();
  }, []);

  async function loadPhotoStats() {
    try {
      const [photos, pending] = await Promise.all([
        listLocalPhotos(),
        getPendingUploads(),
      ]);
      setLocalPhotoCount(photos.length);
      setPendingUploadCount(pending.length);
    } catch (err) {
      console.error('Failed to load photo stats:', err.message);
    }
  }

  async function loadSettings() {
    try {
      setLoading(true);
      const [tournamentsData, selectedData, manualData] = await Promise.all([
        getTournaments(),
        AsyncStorage.getItem(SELECTED_TOURNAMENT_KEY),
        AsyncStorage.getItem(MANUAL_PLAYERS_KEY),
      ]);

      setTournaments(tournamentsData);
      
      if (selectedData) {
        setSelectedTournament(JSON.parse(selectedData));
      }
      
      if (manualData) {
        setManualPlayers(JSON.parse(manualData));
      }
    } catch (err) {
      console.error('Failed to load settings:', err.message);
    } finally {
      setLoading(false);
    }
  }

  async function selectTournament(tournament) {
    try {
      await AsyncStorage.setItem(SELECTED_TOURNAMENT_KEY, JSON.stringify(tournament));
      setSelectedTournament(tournament);
      Alert.alert('Success', `Tournament "${tournament.name}" selected`);
    } catch (err) {
      console.error('Failed to save tournament:', err.message);
      Alert.alert('Error', 'Failed to save tournament selection');
    }
  }

  async function downloadPlayers() {
    if (!selectedTournament) {
      Alert.alert('Error', 'Please select a tournament first');
      return;
    }

    try {
      setDownloadingPlayers(true);
      const players = await getPlayers(selectedTournament.omnipongUrl);
      
      if (players.length === 0) {
        Alert.alert('No Players', 'No players found for this tournament');
        return;
      }

      Alert.alert(
        'Players Downloaded',
        `Successfully downloaded ${players.length} players from "${selectedTournament.name}".\n\nGo back to the Players screen to see them.`,
        [{ text: 'OK' }]
      );
    } catch (err) {
      console.error('Failed to download players:', err.message);
      Alert.alert('Error', 'Failed to download players from tournament');
    } finally {
      setDownloadingPlayers(false);
    }
  }

  async function addManualPlayer() {
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      Alert.alert('Error', 'Please enter a player name');
      return;
    }

    try {
      const updated = [...manualPlayers, { id: Date.now(), name: trimmed, isManual: true }];
      await AsyncStorage.setItem(MANUAL_PLAYERS_KEY, JSON.stringify(updated));
      setManualPlayers(updated);
      setNewPlayerName('');
      Alert.alert('Success', `Added "${trimmed}" to tournament`);
    } catch (err) {
      console.error('Failed to add player:', err.message);
      Alert.alert('Error', 'Failed to add player');
    }
  }

  async function removeManualPlayer(player) {
    Alert.alert(
      'Remove Player',
      `Remove "${player.name}" from manual list?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const updated = manualPlayers.filter(p => p.id !== player.id);
              await AsyncStorage.setItem(MANUAL_PLAYERS_KEY, JSON.stringify(updated));
              setManualPlayers(updated);
            } catch (err) {
              console.error('Failed to remove player:', err.message);
              Alert.alert('Error', 'Failed to remove player');
            }
          },
        },
      ]
    );
  }

  async function handleBidirectionalSync() {
    try {
      if (!supabaseReady) {
        Alert.alert('Supabase not configured', 'Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to .env, then reload the app.');
        return;
      }

      setSyncing(true);
      setSyncProgress('Preparing player list...');

      let currentPlayerNames = [];
      if (selectedTournament) {
        try {
          const players = await getPlayers(selectedTournament.omnipongUrl);
          currentPlayerNames = players.map((p) => p.name);
          console.log(`Syncing for ${currentPlayerNames.length} tournament players`);
        } catch (err) {
          console.warn('Could not load tournament players, syncing all:', err.message);
        }
      }

      setSyncProgress('Downloading from Supabase...');
      const downloadResult = await downloadMissingPhotos(
        (progress) => {
          setSyncProgress(progress);
        },
        currentPlayerNames.length > 0 ? currentPlayerNames : null
      );

      setSyncProgress('Uploading local photos...');
      const uploadResult = await uploadAllPhotos((progress) => {
        setSyncProgress(progress);
      });

      setSyncProgress('');
      Alert.alert(
        'Sync Complete',
        `Downloaded: ${downloadResult.downloaded || 0}\nUploaded: ${uploadResult.uploaded || 0}\nSkipped: ${(downloadResult.skipped || 0)}\nFailed: ${(uploadResult.failed || 0) + (downloadResult.failed || 0)}`
      );

      await loadPhotoStats();
    } catch (err) {
      console.error('Sync failed:', err.message);
      Alert.alert('Sync Error', err.message);
    } finally {
      setSyncing(false);
      setSyncProgress('');
    }
  }

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      keyboardVerticalOffset={0}
    >
      <View style={styles.header}>
        <Text style={styles.title}>Settings</Text>
        <Pressable style={styles.backButton} onPress={onBack}>
          <Text style={styles.backButtonText}>← Back</Text>
        </Pressable>
      </View>

      <ScrollView 
        style={styles.content}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={{ paddingBottom: 20 }}
      >
        {/* Section 1: Tournament & Manual Players */}
        <View style={styles.section}>
          <Pressable 
            style={styles.sectionHeader}
            onPress={() => setTournamentSectionExpanded(!tournamentSectionExpanded)}
          >
            <Text style={styles.sectionTitle}>Tournament & Players</Text>
            <Text style={styles.collapseIcon}>{tournamentSectionExpanded ? '▼' : '▶'}</Text>
          </Pressable>
          
          {tournamentSectionExpanded && (
            <>
              <Text style={styles.sectionDescription}>
                Select tournament and download players, or add manual players
              </Text>
              
              {loading ? (
                <ActivityIndicator color="#38bdf8" style={{ marginTop: 12 }} />
              ) : (
                <>
                  {selectedTournament && (
                    <View style={styles.selectedInfo}>
                      <Text style={styles.selectedLabel}>Current:</Text>
                      <Text style={styles.selectedValue}>{selectedTournament.name}</Text>
                    </View>
                  )}
                  {selectedTournament && (
                    <Pressable
                      style={[styles.downloadButton, downloadingPlayers && styles.downloadButtonDisabled]}
                      onPress={downloadPlayers}
                      disabled={downloadingPlayers}
                    >
                      {downloadingPlayers ? (
                        <ActivityIndicator color="#e2e8f0" />
                      ) : (
                        <Text style={styles.downloadButtonText}>Download Players</Text>
                      )}
                    </Pressable>
                  )}
                  <FlatList
                    data={tournaments}
                    keyExtractor={(item) => item.tournamentId}
                    style={styles.tournamentList}
                    scrollEnabled={false}
                    renderItem={({ item }) => {
                      const isSelected = selectedTournament?.tournamentId === item.tournamentId;
                      return (
                        <Pressable
                          style={[styles.tournamentItem, isSelected && styles.tournamentItemSelected]}
                          onPress={() => selectTournament(item)}
                        >
                          <Text style={styles.tournamentName}>{item.name}</Text>
                          {isSelected && <Text style={styles.checkmark}>✓</Text>}
                        </Pressable>
                      );
                    }}
                  />
                </>
              )}
              
              {/* Manual Player Addition */}
              <View style={styles.subsection}>
                <Text style={styles.subsectionTitle}>Manual Players</Text>
                <Text style={styles.sectionDescription}>
                  Add players not registered via Omnipong
                </Text>
                
                <View style={styles.addPlayerForm}>
                  <TextInput
                    placeholder="Player name"
                    placeholderTextColor="#94a3b8"
                    value={newPlayerName}
                    onChangeText={setNewPlayerName}
                    style={styles.playerInput}
                    onSubmitEditing={addManualPlayer}
                  />
                  <Pressable style={styles.addButton} onPress={addManualPlayer}>
                    <Text style={styles.addButtonText}>Add</Text>
                  </Pressable>
                </View>

                {manualPlayers.length > 0 && (
                  <FlatList
                    data={manualPlayers}
                    keyExtractor={(item) => String(item.id)}
                    style={styles.manualPlayerList}
                    scrollEnabled={false}
                    renderItem={({ item }) => (
                      <View style={styles.manualPlayerRow}>
                        <Text style={styles.manualPlayerName}>{item.name}</Text>
                        <Pressable style={styles.removeButton} onPress={() => removeManualPlayer(item)}>
                          <Text style={styles.removeButtonText}>Remove</Text>
                        </Pressable>
                      </View>
                    )}
                  />
                )}
              </View>
            </>
          )}
        </View>

        {/* Section 2: Supabase Storage */}
        <View style={styles.section}>
          <Pressable 
            style={styles.sectionHeader}
            onPress={() => setStorageSectionExpanded(!storageSectionExpanded)}
          >
            <Text style={styles.sectionTitle}>Supabase Storage</Text>
            <Text style={styles.collapseIcon}>{storageSectionExpanded ? '▼' : '▶'}</Text>
          </Pressable>
          
          {storageSectionExpanded && (
            <>
              <Text style={styles.sectionDescription}>
                Photos sync to the Supabase bucket "tournament-players". Make sure the bucket allows read/write with your anon key.
              </Text>

              <View style={styles.selectedInfo}>
                <Text style={styles.selectedLabel}>Bucket</Text>
                <Text style={styles.selectedValue}>tournament-players</Text>
                <Text style={styles.selectedLabel}>
                  Supabase URL & anon key: {supabaseReady ? 'configured' : 'missing'}
                </Text>
              </View>

              {!supabaseReady && (
                <View style={styles.warningCard}>
                  <Text style={styles.warningText}>Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY to your .env to enable sync.</Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* Section 3: Sync and Status (Always Visible) */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync & Status</Text>
          <Text style={styles.sectionDescription}>
            Bi-directional sync: Upload local photos and download missing photos from Supabase
          </Text>
          
          {/* Photo Stats */}
          <View style={styles.statsContainer}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{localPhotoCount}</Text>
              <Text style={styles.statLabel}>Local Photos</Text>
            </View>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{pendingUploadCount}</Text>
              <Text style={styles.statLabel}>Pending Upload</Text>
            </View>
          </View>
          
          <Pressable
            style={[styles.syncButton, syncing && styles.syncButtonDisabled]}
            onPress={handleBidirectionalSync}
            disabled={syncing}
          >
            {syncing ? (
              <View style={styles.syncingContainer}>
                <ActivityIndicator color="#e2e8f0" size="small" />
                {syncProgress && (
                  <Text style={styles.syncProgressText}>{syncProgress}</Text>
                )}
              </View>
            ) : (
              <Text style={styles.syncButtonText}>Sync Now</Text>
            )}
          </Pressable>

          <Pressable
            style={styles.clearButtonAlt}
            onPress={() => setShowPhotoBrowser(true)}
          >
            <Text style={styles.clearButtonAltText}>View Local Photos</Text>
          </Pressable>
        </View>
      </ScrollView>

      <Modal visible={showPhotoBrowser} animationType="slide" onRequestClose={() => setShowPhotoBrowser(false)}>
        <PhotoBrowserScreen
          onClose={() => setShowPhotoBrowser(false)}
          onCleared={async () => {
            await loadPhotoStats();
          }}
        />
      </Modal>
    </KeyboardAvoidingView>
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
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  title: {
    color: '#e2e8f0',
    fontSize: 24,
    fontWeight: '700',
  },
  backButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#334155',
    borderRadius: 8,
  },
  backButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1e293b',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 0,
  },
  collapseIcon: {
    color: '#94a3b8',
    fontSize: 16,
    fontWeight: '600',
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
  },
  sectionDescription: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
    marginTop: 8,
  },
  subsection: {
    marginTop: 16,
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#1e293b',
  },
  subsectionTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  selectedInfo: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  selectedValue: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
  },
  tournamentList: {
    maxHeight: 150,
  },
  tournamentItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 8,
  },
  tournamentItemSelected: {
    backgroundColor: '#2563eb',
  },
  tournamentName: {
    color: '#e2e8f0',
    fontSize: 14,
    flex: 1,
  },
  checkmark: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
    marginLeft: 8,
  },
  addPlayerForm: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 12,
  },
  playerInput: {
    flex: 1,
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  addButton: {
    backgroundColor: '#10b981',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
  },
  manualPlayerList: {
    maxHeight: 200,
  },
  manualPlayerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    marginBottom: 6,
  },
  manualPlayerName: {
    color: '#e2e8f0',
    fontSize: 14,
    flex: 1,
  },
  removeButton: {
    backgroundColor: '#ef4444',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#e2e8f0',
    fontSize: 12,
    fontWeight: '600',
  },
  statsContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  statItem: {
    flex: 1,
    backgroundColor: '#1e293b',
    padding: 16,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  statValue: {
    color: '#38bdf8',
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  statLabel: {
    color: '#94a3b8',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  syncButton: {
    backgroundColor: '#2563eb',
    paddingVertical: 14,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 8,
  },
  syncButtonDisabled: {
    backgroundColor: '#334155',
  },
  syncButtonText: {
    color: '#e2e8f0',
    fontWeight: '700',
    fontSize: 16,
  },
  syncingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  syncProgressText: {
    color: '#e2e8f0',
    fontSize: 14,
    fontWeight: '600',
  },
  warningCard: {
    backgroundColor: '#4b5563',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#fbbf24',
    marginTop: 8,
  },
  warningText: {
    color: '#fef3c7',
    fontSize: 14,
    fontWeight: '600',
  },
  downloadButton: {
    backgroundColor: '#10b981',
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginBottom: 12,
  },
  downloadButtonDisabled: {
    backgroundColor: '#334155',
  },
  downloadButtonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
  clearButtonAlt: {
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#38bdf8',
    backgroundColor: 'transparent',
  },
  clearButtonAltText: {
    color: '#38bdf8',
    fontWeight: '700',
    fontSize: 14,
  },
});
