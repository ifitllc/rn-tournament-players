import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Alert, Keyboard, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// This is critical for the auth flow to work
WebBrowser.maybeCompleteAuthSession({
  skipRedirectCheck: false,
});

const GOOGLE_CLIENT_ID = Constants.expoConfig?.extra?.googleClientId || process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = ''; // Optional, can leave empty for mobile apps

// Explicitly construct Expo auth proxy URL
// Format: https://auth.expo.io/@owner/slug
const REDIRECT_URI = `https://auth.expo.io/@${Constants.expoConfig?.owner || 'fanyang_us'}/${Constants.expoConfig?.slug || 'tournament-players'}`;

const discovery = {
  authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenEndpoint: 'https://oauth2.googleapis.com/token',
  revocationEndpoint: 'https://oauth2.googleapis.com/revoke',
};

export default function GoogleDriveAuth({ onAuthComplete }) {
  const [manualToken, setManualToken] = useState('');
  const [saving, setSaving] = useState(false);
  const [hasToken, setHasToken] = useState(false);
  const [tokenInfo, setTokenInfo] = useState(null);

  // Log redirect URI on component mount
  useEffect(() => {
    console.log('🔍 OAuth Redirect URI:', REDIRECT_URI);
    console.log('📝 Add this exact URI to Google Cloud Console:');
    console.log('   Authorized redirect URIs section');
    console.log('   Owner:', Constants.expoConfig?.owner || 'fanyang_us');
    console.log('   Slug:', Constants.expoConfig?.slug || 'tournament-players');
  }, []);

  const [request, response, promptAsync] = AuthSession.useAuthRequest(
    {
      clientId: GOOGLE_CLIENT_ID,
      scopes: ['https://www.googleapis.com/auth/drive'],
      redirectUri: REDIRECT_URI,
      responseType: 'code',
      usePKCE: true,
    },
    discovery
  );

  useEffect(() => {
    checkExistingToken();
  }, []);

  useEffect(() => {
    console.log('📱 Auth response received:', response?.type);
    
    if (response?.type === 'success') {
      console.log('✅ OAuth success, exchanging code for token');
      const { code } = response.params;
      exchangeCodeForToken(code);
    } else if (response?.type === 'error') {
      console.error('❌ OAuth error:', response.params);
      Alert.alert(
        'Authentication Error',
        response.params.error_description || response.params.error || 'Failed to authenticate'
      );
    } else if (response?.type === 'dismiss') {
      console.log('👋 User dismissed the auth browser');
    } else if (response?.type === 'cancel') {
      console.log('🚫 User cancelled the auth flow');
    }
  }, [response]);

  async function checkExistingToken() {
    try {
      const token = await AsyncStorage.getItem('@gdrive_access_token');
      const expiry = await AsyncStorage.getItem('@gdrive_token_expiry');
      const refreshToken = await AsyncStorage.getItem('@gdrive_refresh_token');
      
      if (token) {
        setHasToken(true);
        const expiryDate = expiry ? new Date(parseInt(expiry, 10)) : null;
        const isExpired = expiryDate && expiryDate < new Date();
        
        setTokenInfo({
          hasToken: true,
          isExpired,
          expiryDate,
          hasRefreshToken: !!refreshToken,
        });
      }
    } catch (err) {
      console.error('Failed to check token:', err);
    }
  }

  async function exchangeCodeForToken(code) {
    try {
      setSaving(true);
      
      const tokenResponse = await AuthSession.exchangeCodeAsync(
        {
          clientId: GOOGLE_CLIENT_ID,
          code,
          redirectUri: REDIRECT_URI,
          extraParams: {
            code_verifier: request?.codeVerifier || '',
          },
        },
        discovery
      );

      await saveTokens(tokenResponse);
      Alert.alert('Success', 'Successfully authenticated with Google Drive!');
      await checkExistingToken();
      if (onAuthComplete) onAuthComplete();
    } catch (err) {
      console.error('Token exchange failed:', err);
      Alert.alert('Error', 'Failed to exchange authorization code for token');
    } finally {
      setSaving(false);
    }
  }

  async function saveTokens(tokenResponse) {
    const expiryTime = Date.now() + (tokenResponse.expiresIn || 3600) * 1000;
    
    await AsyncStorage.setItem('@gdrive_access_token', tokenResponse.accessToken);
    await AsyncStorage.setItem('@gdrive_token_expiry', String(expiryTime));
    
    if (tokenResponse.refreshToken) {
      await AsyncStorage.setItem('@gdrive_refresh_token', tokenResponse.refreshToken);
    }
  }

  async function saveManualToken() {
    const trimmed = manualToken.trim().replace(/\s+/g, ''); // Remove all whitespace
    if (!trimmed) {
      Alert.alert('Error', 'Please enter an access token');
      return;
    }

    // Validate token format (should start with ya29.)
    if (!trimmed.startsWith('ya29.')) {
      Alert.alert(
        'Invalid Token Format',
        'Google access tokens should start with "ya29.". Please check your token and try again.'
      );
      return;
    }

    try {
      // Dismiss keyboard first
      Keyboard.dismiss();
      
      setSaving(true);
      console.log('💾 Saving token (first 30 chars):', trimmed.substring(0, 30) + '...');
      console.log('📏 Token length:', trimmed.length);
      
      await AsyncStorage.setItem('@gdrive_access_token', trimmed);
      // Set expiry to 1 hour from now
      const expiryTime = Date.now() + 3600 * 1000;
      await AsyncStorage.setItem('@gdrive_token_expiry', String(expiryTime));
      
      Alert.alert('Success', 'Access token saved! You can now try syncing.');
      setManualToken('');
      await checkExistingToken();
      if (onAuthComplete) onAuthComplete();
    } catch (err) {
      console.error('Failed to save token:', err);
      Alert.alert('Error', 'Failed to save access token');
    } finally {
      setSaving(false);
    }
  }

  async function clearToken() {
    Alert.alert(
      'Clear Token',
      'Are you sure you want to remove the stored access token?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            try {
              await AsyncStorage.multiRemove([
                '@gdrive_access_token',
                '@gdrive_token_expiry',
                '@gdrive_refresh_token',
              ]);
              setHasToken(false);
              setTokenInfo(null);
              Alert.alert('Success', 'Token cleared');
            } catch (err) {
              console.error('Failed to clear token:', err);
              Alert.alert('Error', 'Failed to clear token');
            }
          },
        },
      ]
    );
  }

  async function refreshAccessToken() {
    try {
      setSaving(true);
      const refreshToken = await AsyncStorage.getItem('@gdrive_refresh_token');
      
      if (!refreshToken) {
        Alert.alert('Error', 'No refresh token available. Please authenticate again.');
        return;
      }

      const tokenResponse = await AuthSession.refreshAsync(
        {
          clientId: GOOGLE_CLIENT_ID,
          refreshToken,
        },
        discovery
      );

      await saveTokens({ ...tokenResponse, refreshToken }); // Keep the refresh token
      Alert.alert('Success', 'Access token refreshed!');
      await checkExistingToken();
    } catch (err) {
      console.error('Token refresh failed:', err);
      Alert.alert('Error', 'Failed to refresh token. Please authenticate again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Google Drive Authentication</Text>
      
      {hasToken && tokenInfo && (
        <View style={styles.statusCard}>
          <Text style={styles.statusLabel}>Status:</Text>
          <Text style={[styles.statusValue, tokenInfo.isExpired && styles.statusExpired]}>
            {tokenInfo.isExpired ? '⚠️ Token Expired' : '✓ Authenticated'}
          </Text>
          {tokenInfo.expiryDate && (
            <Text style={styles.statusDetail}>
              Expires: {tokenInfo.expiryDate.toLocaleString()}
            </Text>
          )}
          {tokenInfo.hasRefreshToken && (
            <Text style={styles.statusDetail}>✓ Refresh token available</Text>
          )}
        </View>
      )}

      {hasToken && (
        <View style={styles.tokenActions}>
          {tokenInfo?.hasRefreshToken && (
            <Pressable
              style={[styles.button, styles.refreshButton]}
              onPress={refreshAccessToken}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color="#e2e8f0" />
              ) : (
                <Text style={styles.buttonText}>Refresh Token</Text>
              )}
            </Pressable>
          )}
          <Pressable
            style={[styles.button, styles.clearButton]}
            onPress={clearToken}
            disabled={saving}
          >
            <Text style={styles.buttonText}>Clear Token</Text>
          </Pressable>
        </View>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>OAuth 2.0 (Recommended)</Text>
      <Text style={styles.description}>
        Authenticate with Google using OAuth 2.0 for secure, long-term access.
      </Text>
      
      {!GOOGLE_CLIENT_ID ? (
        <View style={styles.warningCard}>
          <Text style={styles.warningText}>
            ⚠️ Please configure EXPO_PUBLIC_GOOGLE_CLIENT_ID in your .env file
          </Text>
        </View>
      ) : (
        <Pressable
          style={[styles.button, styles.oauthButton]}
          onPress={() => promptAsync()}
          disabled={!request || saving}
        >
          {saving ? (
            <ActivityIndicator color="#e2e8f0" />
          ) : (
            <Text style={styles.buttonText}>Sign in with Google</Text>
          )}
        </Pressable>
      )}

      <View style={styles.divider} />

      <Text style={styles.sectionTitle}>Manual Token (Testing)</Text>
      <Text style={styles.description}>
        For testing only. Get a token from OAuth 2.0 Playground.
      </Text>
      
      <TextInput
        placeholder="Paste access token here"
        placeholderTextColor="#64748b"
        value={manualToken}
        onChangeText={setManualToken}
        style={styles.input}
        multiline
        numberOfLines={3}
        secureTextEntry={false}
        blurOnSubmit={true}
        returnKeyType="done"
      />
      
      <Pressable
        style={[styles.button, styles.manualButton]}
        onPress={saveManualToken}
        disabled={saving}
      >
        {saving ? (
          <ActivityIndicator color="#e2e8f0" />
        ) : (
          <Text style={styles.buttonText}>Save Token</Text>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  title: {
    color: '#e2e8f0',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  statusCard: {
    backgroundColor: '#1e293b',
    padding: 12,
    borderRadius: 8,
    marginBottom: 16,
  },
  statusLabel: {
    color: '#94a3b8',
    fontSize: 12,
    marginBottom: 4,
  },
  statusValue: {
    color: '#10b981',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  statusExpired: {
    color: '#f59e0b',
  },
  statusDetail: {
    color: '#94a3b8',
    fontSize: 12,
    marginTop: 2,
  },
  tokenActions: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: '#334155',
    marginVertical: 16,
  },
  sectionTitle: {
    color: '#e2e8f0',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  description: {
    color: '#94a3b8',
    fontSize: 14,
    marginBottom: 12,
    lineHeight: 20,
  },
  warningCard: {
    backgroundColor: '#7c2d12',
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  warningText: {
    color: '#fef3c7',
    fontSize: 13,
    lineHeight: 18,
  },
  input: {
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  oauthButton: {
    backgroundColor: '#2563eb',
  },
  manualButton: {
    backgroundColor: '#64748b',
  },
  refreshButton: {
    backgroundColor: '#10b981',
    flex: 1,
  },
  clearButton: {
    backgroundColor: '#ef4444',
    flex: 1,
  },
  buttonText: {
    color: '#e2e8f0',
    fontWeight: '600',
    fontSize: 14,
  },
});
