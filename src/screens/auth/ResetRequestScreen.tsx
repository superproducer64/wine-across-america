import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  TouchableWithoutFeedback,
  Keyboard,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { requestPasswordReset } from '@/lib/supabase';
import { AuthStackParamList } from '@/navigation/types';
import { useResponsive } from '@/hooks/useResponsive';

type Props = NativeStackScreenProps<AuthStackParamList, 'ResetRequest'>;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function ResetRequestScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [sent, setSent] = useState(false);
  const { isWide } = useResponsive();

  const handleSubmit = async () => {
    setError('');
    if (!EMAIL_RE.test(email.trim())) {
      setError('Please enter a valid email address.');
      return;
    }
    setLoading(true);
    await requestPasswordReset(email.trim());
    setLoading(false);
    // Always show the same confirmation, whether or not the email is on file,
    // so this endpoint can't be used to enumerate registered accounts.
    setSent(true);
  };

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
            <Text style={styles.trophy}>🔑</Text>
            <Text style={styles.title}>Reset Password</Text>
            <Text style={styles.subtitle}>
              Enter your email and we'll send you a reset link
            </Text>
          </View>

          <View style={styles.form}>
            {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

            {sent ? (
              <View style={styles.successBanner}>
                <Text style={styles.successText}>
                  Check your email for a reset link.
                </Text>
                <Pressable onPress={() => navigation.navigate('Login')}>
                  <Text style={styles.successLink}>Back to Sign In →</Text>
                </Pressable>
              </View>
            ) : (
              <>
                <TextInput
                  label="Email"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="you@example.com"
                  returnKeyType="done"
                  onSubmitEditing={() => {
                    Keyboard.dismiss();
                    handleSubmit();
                  }}
                />

                <Button
                  label="Send Reset Link"
                  onPress={handleSubmit}
                  loading={loading}
                  style={styles.submitBtn}
                />
              </>
            )}
          </View>

          <Pressable onPress={() => navigation.navigate('Login')}>
            <Text style={styles.footerText}>
              Remembered your password?{' '}
              <Text style={styles.footerLink}>Sign in</Text>
            </Text>
          </Pressable>
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
  successBanner: {
    backgroundColor: 'rgba(40,167,69,0.1)',
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: 8,
    alignItems: 'center',
  },
  successText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: '#28a745',
    textAlign: 'center',
  },
  successLink: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.gold,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
  footerText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  footerLink: {
    color: Colors.gold,
    fontFamily: Fonts.dmSansRegular,
  },
});
