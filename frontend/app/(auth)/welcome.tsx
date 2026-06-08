import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { Button } from '../../src/components/Button';
import { api } from '../../src/services/api';

export default function Welcome() {
  const router = useRouter();
  const { t, setUser, colors } = useApp();
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);

  // Form state
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');

  const handleSubmit = async () => {
    if (!phoneNumber || !password || (!isLogin && !displayName)) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      let res;
      if (isLogin) {
        res = await api.loginWithPhone(phoneNumber, password);
      } else {
        res = await api.registerWithPhone(phoneNumber, password, displayName);
      }

      await setUser(res.user, res.token);
      router.replace('/(tabs)/home');
    } catch (error: any) {
      Alert.alert('Authentication Failed', error.message || 'An error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.header}>
          <Typography variant="h1" align="center" style={styles.title}>
            {isLogin ? 'Welcome Back' : 'Create Account'}
          </Typography>
          <Typography variant="body2" color={colors.black2} align="center" style={styles.desc}>
            {isLogin ? 'Login to continue to SkillMatch' : 'Sign up to showcase and find services'}
          </Typography>
        </View>

        <View style={styles.formContainer}>
          {!isLogin && (
            <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <TextInput
                placeholder="Full Name"
                placeholderTextColor={colors.black3}
                style={[styles.input, { color: colors.text }]}
                value={displayName}
                onChangeText={setDisplayName}
              />
            </View>
          )}

          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder="Phone Number"
              placeholderTextColor={colors.black3}
              keyboardType="phone-pad"
              style={[styles.input, { color: colors.text }]}
              value={phoneNumber}
              onChangeText={setPhoneNumber}
            />
          </View>

          <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <TextInput
              placeholder="Password"
              placeholderTextColor={colors.black3}
              secureTextEntry
              style={[styles.input, { color: colors.text }]}
              value={password}
              onChangeText={setPassword}
            />
          </View>

          <Button
            title={isLogin ? 'Login' : 'Sign Up'}
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            style={styles.btn}
          />

          <TouchableOpacity onPress={() => setIsLogin(!isLogin)} style={styles.toggleBtn}>
            <Typography variant="body2" color={colors.primary} align="center">
              {isLogin ? 'Don\'t have an account? Sign Up' : 'Already have an account? Login'}
            </Typography>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'center' },
  header: {
    padding: 24,
    alignItems: 'center',
    marginTop: 40,
  },
  title: { marginBottom: 10 },
  desc: { marginBottom: 30 },
  formContainer: {
    padding: 24,
    width: '100%',
  },
  inputGroup: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 16,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Inter-Medium',
  },
  btn: { width: '100%', borderRadius: 30, marginTop: 10 },
  toggleBtn: {
    marginTop: 20,
    padding: 10,
  },
});