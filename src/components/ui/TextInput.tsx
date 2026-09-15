import React, { forwardRef, useState } from 'react';
import {
  TextInput as RNTextInput,
  View,
  Text,
  Pressable,
  StyleSheet,
  TextInputProps,
  ViewStyle,
} from 'react-native';
import { Colors, Fonts, Radius, Spacing } from '@/theme';

interface Props extends TextInputProps {
  label?: string;
  error?: string;
  hint?: string;
  containerStyle?: ViewStyle;
}

export const TextInput = forwardRef<RNTextInput, Props>(function TextInput(
  { label, error, hint, containerStyle, style, ...props },
  ref
) {
  const [focused, setFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const isPassword = props.secureTextEntry === true;

  return (
    <View style={[styles.container, containerStyle]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View style={styles.inputWrapper}>
        <RNTextInput
          ref={ref}
          {...props}
          secureTextEntry={isPassword && !showPassword}
          style={[
            styles.input,
            focused && styles.inputFocused,
            error ? styles.inputError : undefined,
            props.multiline && styles.multiline,
            isPassword && styles.inputWithToggle,
            style,
          ]}
          placeholderTextColor={Colors.inkFaint}
          onFocus={(e) => {
            setFocused(true);
            props.onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            props.onBlur?.(e);
          }}
        />
        {isPassword && (
          <Pressable
            style={styles.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={8}
          >
            <Text style={styles.eyeIcon}>{showPassword ? '🙈' : '👁'}</Text>
          </Pressable>
        )}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      {!error && hint ? <Text style={styles.hint}>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing.md,
  },
  label: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
    marginBottom: 6,
  },
  inputWrapper: {
    position: 'relative',
    justifyContent: 'center',
  },
  input: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 15,
    color: Colors.ink,
    backgroundColor: Colors.surfaceAlt,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 11,
  },
  inputFocused: {
    borderColor: Colors.gold,
    backgroundColor: Colors.surface,
  },
  inputError: {
    borderColor: Colors.red,
  },
  inputWithToggle: {
    paddingRight: 44,
  },
  multiline: {
    height: 96,
    textAlignVertical: 'top',
    paddingTop: 11,
  },
  eyeBtn: {
    position: 'absolute',
    right: Spacing.md,
    padding: 2,
  },
  eyeIcon: {
    fontSize: 16,
  },
  error: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.red,
    marginTop: 4,
  },
  hint: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 4,
  },
});
