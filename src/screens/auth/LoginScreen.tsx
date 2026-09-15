import React, { useRef, useState } from 'react';
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
  TextInput as RNTextInput,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { Button } from '@/components/ui/Button';
import { TextInput } from '@/components/ui/TextInput';
import { signInWithEmail, signInWithApple, generateAppleNonce } from '@/lib/supabase';
import { AuthStackParamList } from '@/navigation/types';
import { useResponsive } from '@/hooks/useResponsive';

// expo-apple-authentication is iOS-only — require() it lazily so Android never
// tries to link the native module (which doesn't exist on Android).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const getAppleAuth = (): any =>
  Platform.OS === 'ios' ? require('expo-apple-authentication') : null;

type Props = NativeStackScreenProps<AuthStackParamList, 'Login'>;

export function LoginScreen({ navigation }: Props) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [appleLoading, setAppleLoading] = useState(false);
  const [error, setError] = useState('');

  const passwordRef = useRef<RNTextInput>(null);

  const handleLogin = async () => {
    setError('');
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }
    setLoading(true);
    const { error: authError } = await signInWithEmail(email.trim(), password);
    setLoading(false);
    if (authError) {
      setError(authError.message);
    }
  };

  const handleAppleSignIn = async () => {
    setError('');
    setAppleLoading(true);
    try {
      const AppleAuthentication = getAppleAuth();
      if (!AppleAuthentication) return;

      const { rawNonce, hashedNonce } = await generateAppleNonce();
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!credential.identityToken) {
        setError('Apple Sign In failed. Please try again.');
        setAppleLoading(false);
        return;
      }

      const displayName = credential.fullName
        ? [credential.fullName.givenName, credential.fullName.familyName]
            .filter(Boolean)
            .join(' ') || null
        : null;

      const { error: signInError } = await signInWithApple(
        credential.identityToken,
        rawNonce,
        displayName
      );

      if (signInError) {
        setError(signInError);
      }
    } catch (e: unknown) {
      const err = e as { code?: string; message?: string };
      if (err?.code !== 'ERR_REQUEST_CANCELED') {
        setError('Apple Sign In failed. Please try again.');
      }
    }
    setAppleLoading(false);
  };

  const isIOS = Platform.OS === 'ios';
  const { isWide } = useResponsive();

  const renderAppleButton = () => {
    if (!isIOS) return null;
    const AA = getAppleAuth();
    if (!AA) return null;
    return (
      <>
        <View style={styles.divider}>
          <View style={styles.dividerLine} />
          <Text style={styles.dividerText}>or</Text>
          <View style={styles.dividerLine} />
        </View>
        <AA.AppleAuthenticationButton
          buttonType={AA.AppleAuthenticationButtonType.SIGN_IN}
          buttonStyle={AA.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={Radius.md}
          style={styles.appleBtn}
          onPress={handleAppleSignIn}
        />
      </>
    );
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
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.trophy}>🏆</Text>
          <Text style={styles.title}>Pour Across{'\n'}America</Text>
          <Text style={styles.subtitle}>Wine Intelligence App</Text>
        </View>

        {/* Form */}
        <View style={styles.form}>
          <Text style={styles.formTitle}>Sign In</Text>

          {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

          <TextInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="you@example.com"
            returnKeyType="next"
            onSubmitEditing={() => passwordRef.current?.focus()}
            blurOnSubmit={false}
          />

          <TextInput
            ref={passwordRef}
            label="Password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            returnKeyType="done"
            onSubmitEditing={() => {
              Keyboard.dismiss();
              handleLogin();
            }}
          />

          <Pressable onPress={() => navigation.navigate('ResetRequest')}>
            <Text style={styles.forgotPassword}>Forgot password?</Text>
          </Pressable>

          <Button
            label="Sign In"
            onPress={handleLogin}
            loading={loading}
            style={styles.submitBtn}
          />

          {renderAppleButton()}
        </View>

        {/* Footer */}
        <Pressable onPress={() => navigation.navigate('Signup')}>
          <Text style={styles.footerText}>
            New here?{' '}
            <Text style={styles.footerLink}>Create an account</Text>
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
    fontSize: 44,
    marginBottom: 4,
  },
  title: {
    fontFamily: Fonts.playfair,
    fontSize: 30,
    color: Colors.gold,
    textAlign: 'center',
    lineHeight: 36,
  },
  subtitle: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  form: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.lg,
    padding: Spacing.xl,
    gap: 4,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
  },
  formTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 20,
    color: Colors.ink,
    marginBottom: Spacing.md,
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
  forgotPassword: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.gold,
    textAlign: 'right',
    marginTop: 2,
    marginBottom: 4,
  },
  submitBtn: {
    marginTop: Spacing.sm,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    marginVertical: Spacing.md,
  },
  dividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: Colors.border,
  },
  dividerText: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkFaint,
  },
  appleBtn: {
    width: '100%',
    height: 48,
    marginBottom: Spacing.sm,
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
