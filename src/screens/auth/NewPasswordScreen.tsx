import React, { useRef, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Alert,
  TouchableWithoutFeedback,
  Keyboard,
  TextInput as RNTextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { updateUserPassword } from '@/lib/supabase';
import { AuthStackParamList } from '@/navigation/types';
import { usePasswordRecoveryStore } from '@/stores/passwordRecoveryStore';
import { useResponsive } from '@/hooks/useResponsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'NewPassword'>;

export function NewPasswordScreen({ route, navigation }: Props) {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expiredMessage, setExpiredMessage] = useState<string | null>(route.params?.error ?? null);
  const { isWide } = useResponsive();
  const clearRecovery = usePasswordRecoveryStore((s) => s.clear);
  const confirmRef = useRef<RNTextInput>(null);

  const handleBackToReset = () => {
    clearRecovery();
    navigation.navigate('ResetRequest');
  };

  const handleSubmit = async () => {
    setError('');
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    const { error: updateError } = await updateUserPassword(password);
    setLoading(false);
    if (updateError) {
      // A failed update here almost always means the recovery link's session
      // has expired or was already used — route through the same "expired"
      // state as an invalid link rather than a generic inline error.
      setExpiredMessage(updateError);
      return;
    }
    Alert.alert('Password Updated', 'Your password has been updated successfully.');
    clearRecovery();
  };

  if (expiredMessage) {
    return (
      <View style={styles.flex}>
        <ScrollView contentContainerStyle={styles.container}>
          <View style={isWide ? styles.wideInner : undefined}>
            <View style={styles.header}>
              <Text style={styles.trophy}>⏳</Text>
              <Text style={styles.title}>Link Expired</Text>
              <Text style={styles.subtitle}>{expiredMessage}</Text>
            </View>
            <Button
              label="Request a New Link"
              onPress={handleBackToReset}
              style={styles.submitBtn}
            />
          </View>
        </ScrollView>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={isWide ? styles.wideInner : undefined}>
          <View style={styles.header}>
            <Text style={styles.trophy}>🔒</Text>
            <Text style={styles.title}>Set New Password</Text>
            <Text style={styles.subtitle}>Choose a new password for your account</Text>
          </View>

          <View style={styles.form}>
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            <TextInput
              label="New Password"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              placeholder="8+ characters"
              returnKeyType="next"
              onSubmitEditing={() => confirmRef.current?.focus()}
              blurOnSubmit={false}
            />
            <TextInput
              ref={confirmRef}
              label="Confirm Password"
              value={confirm}
              onChangeText={setConfirm}
              secureTextEntry
              placeholder="Re-enter password"
              returnKeyType="done"
              onSubmitEditing={() => {
                Keyboard.dismiss();
                handleSubmit();
              }}
            />

            <Button
              label="Update Password"
              onPress={handleSubmit}
              loading={loading}
              style={styles.submitBtn}
            />
          </View>
        </View>
      </ScrollView>
      </TouchableWithoutFeedback>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: Colors.ink },
  container: {
    flexGrow: 1,
    paddingHorizontal: Spacing.xxl,
    paddingTop: Spacing.huge,
    paddingBottom: Spacing.xxxl,
    justifyContent: 'center',
    gap: Spacing.xl,
  },
  wideInner: {
    width: '100%',
    maxWidth: 480,
    alignSelf: 'center',
    gap: Spacing.xl,
  },
  header: {
    alignItems: 'center',
    gap: 6,
  },
  trophy: {
    fontSize: 40,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.playfair,
    fontSize: 26,
    color: Colors.gold,
    textAlign: 'center',
  },
  subtitle: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.45)',
    textAlign: 'center',
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: 4,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  errorBanner: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.red,
    backgroundColor: 'rgba(220,53,69,0.1)',
    borderRadius: Radius.sm,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
});
