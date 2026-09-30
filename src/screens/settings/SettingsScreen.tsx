import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  SafeAreaView,
  Pressable,
  Switch,
  Alert,
  Image,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Colors, Fonts, Spacing, Radius } from '@/theme';
import { useResponsive, SIDEBAR_WIDTH, MAX_CONTENT_WIDTH } from '@/hooks/useResponsive';
import { Button } from '@/components/ui/Button';
import { useAuthStore } from '@/stores/authStore';
import { useSubscriptionStore } from '@/stores/subscriptionStore';
import { SHOW_SUBSCRIPTION_UI } from '@/config/featureFlags';
import { SommelierCertUpload } from '@/components/auth/SommelierCertUpload';
import {
  uploadSommelierCert,
  submitSommelierApplication,
  getPendingSommelierCount,
  updateUserProfile,
  uploadAvatar,
  fetchUnreadMessageCount,
  deleteOwnAccount,
} from '@/lib/supabase';
import { MainStackParamList } from '@/navigation/types';

export function SettingsScreen() {
  const navigation = useNavigation<NativeStackNavigationProp<MainStackParamList>>();
  const { user, profile, signOut, loadProfile, setProfile } = useAuthStore();
  const { isSubscribed } = useSubscriptionStore();
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [deleting, setDeleting] = useState(false);
  const [showUpgradeInfo, setShowUpgradeInfo] = useState(false);
  const [showSommelierApply, setShowSommelierApply] = useState(false);
  const [certDataUrl, setCertDataUrl] = useState<string | null>(null);
  const [certMime, setCertMime] = useState<string | null>(null);
  const [certUploading, setCertUploading] = useState(false);
  const [certError, setCertError] = useState('');
  const [certSuccess, setCertSuccess] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [directoryVisible, setDirectoryVisible] = useState(profile?.directory_visible ?? true);
  const [directorySaving, setDirectorySaving] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { isWide } = useResponsive();

  useEffect(() => {
    setDirectoryVisible(profile?.directory_visible ?? true);
  }, [profile?.directory_visible]);

  useFocusEffect(
    useCallback(() => {
      if (user) {
        loadProfile(user.id);
      }
    }, [user, loadProfile])
  );

  useFocusEffect(
    useCallback(() => {
      if (profile?.is_creator) {
        getPendingSommelierCount().then(setPendingCount);
      }
    }, [profile?.is_creator])
  );

  useFocusEffect(
    useCallback(() => {
      if (user) {
        fetchUnreadMessageCount(user.id).then(setUnreadCount);
      }
    }, [user])
  );

  const isSommelierApproved =
    profile?.user_role === 'sommelier' && profile?.sommelier_status === 'approved';
  const isSommelierPending = profile?.sommelier_status === 'pending';
  const isSommelierRejected = profile?.sommelier_status === 'rejected';
  const isSommelierNeedsResubmission = profile?.sommelier_status === 'needs_resubmission';
  const isEnthusiast =
    !isSommelierApproved && !isSommelierPending && !isSommelierRejected && !isSommelierNeedsResubmission;

  const handleSommelierApply = async () => {
    if (!certDataUrl || !user) {
      Alert.alert('Certificate Required', 'Please upload your Level 3 certification before submitting.');
      return;
    }
    setCertUploading(true);
    setCertError('');
    const { url, error: uploadError } = await uploadSommelierCert(user.id, certDataUrl, certMime ?? undefined);
    if (uploadError || !url) {
      const msg = uploadError ?? 'Upload failed. Please try again.';
      setCertError(msg);
      setCertUploading(false);
      Alert.alert('Upload Failed', msg);
      return;
    }
    const { error: applyError } = await submitSommelierApplication(user.id, url, profile?.display_name);
    if (applyError) {
      setCertError(applyError);
      setCertUploading(false);
      Alert.alert('Submission Failed', applyError);
      return;
    }
    await loadProfile(user.id);
    setCertUploading(false);
    setCertSuccess(true);
    setShowSommelierApply(false);
  };

  const handleToggleDirectoryVisible = async (value: boolean) => {
    if (!user) return;
    setDirectoryVisible(value);
    setDirectorySaving(true);
    const { data, error: updateError } = await updateUserProfile(user.id, { directory_visible: value });
    if (updateError) {
      setDirectoryVisible(!value);
      Alert.alert('Update Failed', 'Could not update your directory visibility. Please try again.');
    } else if (data) {
      setProfile(data);
    }
    setDirectorySaving(false);
  };

  const handlePickAvatar = async () => {
    if (!user || avatarUploading) return;
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission Needed', 'Photo library permission is required to set a profile picture.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.85,
    });
    if (result.canceled || !result.assets?.[0]?.uri) return;

    setAvatarUploading(true);
    try {
      const { url, error: uploadError } = await uploadAvatar(user.id, result.assets[0].uri);
      if (uploadError || !url) {
        Alert.alert('Upload Failed', uploadError ?? 'Could not upload your photo. Please try again.');
        return;
      }
      const { data, error: saveError } = await updateUserProfile(user.id, { avatar_url: url });
      if (saveError) {
        Alert.alert('Upload Failed', 'Photo uploaded but could not be saved to your profile. Please try again.');
        return;
      }
      if (data) setProfile(data);
      setAvatarImageError(false);
    } catch {
      Alert.alert('Upload Failed', 'Something went wrong uploading your photo. Please try again.');
    } finally {
      setAvatarUploading(false);
    }
  };

  const handleDeleteAccount = async () => {
    setDeleting(true);
    const { error } = await deleteOwnAccount();
    setDeleting(false);
    if (error) {
      Alert.alert('Something Went Wrong', "We couldn't delete your account. Please check your connection and try again.");
      return;
    }
    await signOut();
  };

  const roleBadge = isSommelierApproved
    ? { label: 'Sommelier', icon: '🎓', color: Colors.gold }
    : { label: 'Wine Explorer', icon: '🍷', color: Colors.inkMuted };

  return (
    <SafeAreaView style={[styles.safe, isWide && { paddingLeft: SIDEBAR_WIDTH }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
      <View style={isWide ? { maxWidth: MAX_CONTENT_WIDTH, alignSelf: 'center', width: '100%' } : undefined}>
        <Text style={styles.title}>Account</Text>

        {/* Profile */}
        <View style={styles.profileCard}>
          <Pressable onPress={handlePickAvatar} disabled={avatarUploading}>
            {profile?.avatar_url && !avatarImageError ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={styles.avatar}
                onError={() => setAvatarImageError(true)}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(profile?.display_name ?? user?.email ?? '?')[0].toUpperCase()}
                </Text>
              </View>
            )}
            {avatarUploading && (
              <View style={styles.avatarLoadingOverlay}>
                <ActivityIndicator color={Colors.white} size="small" />
              </View>
            )}
            <View style={styles.avatarEditBadge}>
              <Text style={styles.avatarEditBadgeText}>✎</Text>
            </View>
          </Pressable>
          <View style={styles.profileInfo}>
            {profile?.display_name ? (
              <Text style={styles.displayName}>{profile.display_name}</Text>
            ) : null}
            <Text style={styles.email}>{user?.email ?? '—'}</Text>
            <View style={styles.roleBadgeRow}>
              <Text style={styles.roleBadgeIcon}>{roleBadge.icon}</Text>
              <Text style={[styles.roleBadgeLabel, { color: roleBadge.color }]}>
                {roleBadge.label}
              </Text>
              {isSommelierApproved && (
                <View style={styles.verifiedPill}>
                  <Text style={styles.verifiedPillText}>Verified</Text>
                </View>
              )}
              {isSommelierPending && (
                <View style={[styles.verifiedPill, styles.pendingPill]}>
                  <Text style={[styles.verifiedPillText, styles.pendingPillText]}>Pending Review</Text>
                </View>
              )}
              {isSommelierRejected && (
                <View style={[styles.verifiedPill, styles.rejectedPill]}>
                  <Text style={[styles.verifiedPillText, styles.rejectedPillText]}>Not Approved</Text>
                </View>
              )}
              {isSommelierNeedsResubmission && (
                <View style={[styles.verifiedPill, styles.resubmitPill]}>
                  <Text style={[styles.verifiedPillText, styles.resubmitPillText]}>Needs Resubmission</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Member Directory */}
        <View style={styles.directoryCard}>
          <Pressable
            style={styles.adminCardInner}
            onPress={() => navigation.navigate('MemberDirectory')}
          >
            <View style={styles.adminCardLeft}>
              <Text style={styles.adminCardTitle}>Member Directory</Text>
              <Text style={styles.adminCardSub}>Browse fellow tasters in the community</Text>
            </View>
            <Text style={styles.adminCardArrow}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.adminCardInner, styles.inviteRow]}
            onPress={() => navigation.navigate('InviteMembers')}
          >
            <View style={styles.adminCardLeft}>
              <Text style={styles.adminCardTitle}>Invite Members</Text>
              <Text style={styles.adminCardSub}>Share a personal invite link with friends</Text>
            </View>
            <Text style={styles.adminCardArrow}>›</Text>
          </Pressable>

          <Pressable
            style={[styles.adminCardInner, styles.inviteRow]}
            onPress={() => navigation.navigate('Inbox')}
          >
            <View style={styles.adminCardLeft}>
              <Text style={styles.adminCardTitle}>Messages</Text>
              <Text style={styles.adminCardSub}>Messages from other members</Text>
            </View>
            <View style={styles.adminCardRight}>
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount}</Text>
                </View>
              )}
              <Text style={styles.adminCardArrow}>›</Text>
            </View>
          </Pressable>

          <View style={styles.directoryToggleRow}>
            <View style={styles.toggleInfo}>
              <View>
                <Text style={styles.toggleTitle}>Show me in the member directory</Text>
                <Text style={styles.toggleSub}>Other members can see your name & avatar</Text>
              </View>
            </View>
            <Switch
              value={directoryVisible}
              onValueChange={handleToggleDirectoryVisible}
              disabled={directorySaving}
              thumbColor={Colors.surface}
              trackColor={{ false: Colors.surfaceAlt, true: Colors.gold }}
            />
          </View>
        </View>

        {/* Rejection banner — always shown when rejected */}
        {isSommelierRejected && (
          <View style={styles.rejectionBanner}>
            <Text style={styles.rejectionBannerTitle}>Application Not Approved</Text>
            <Text style={styles.rejectionBannerBody}>
              {profile?.sommelier_rejection_reason
                ? profile.sommelier_rejection_reason
                : 'Your sommelier application was reviewed and could not be approved at this time. You are welcome to reapply with a valid Level 3 certification.'}
            </Text>
          </View>
        )}

        {/* Needs Resubmission banner */}
        {isSommelierNeedsResubmission && (
          <View style={styles.resubmitReasonCard}>
            <Text style={styles.resubmitReasonLabel}>Action Required</Text>
            <Text style={styles.resubmitReasonText}>
              {profile?.sommelier_rejection_reason
                ? profile.sommelier_rejection_reason
                : 'Your certification could not be verified. Please resubmit a clearer copy of your Level 3 certification.'}
            </Text>
          </View>
        )}

        {/* Sommelier upgrade (for enthusiasts, rejected, and needs_resubmission) */}
        {(isEnthusiast || isSommelierRejected || isSommelierNeedsResubmission) && (
          <View style={styles.sommelierCard}>
            <View style={styles.sommelierHeader}>
              <Text style={styles.sommelierTitle}>
                {isSommelierNeedsResubmission
                  ? '🎓 Resubmit Certification'
                  : isSommelierRejected
                  ? '🎓 Reapply as Sommelier'
                  : '🎓 Apply as Sommelier'}
              </Text>
              <Text style={styles.sommelierDesc}>
                {isSommelierNeedsResubmission
                  ? 'Upload a revised copy of your Level 3 certification. Make sure the document is legible and clearly shows your name and program.'
                  : isSommelierRejected
                  ? 'Your previous application was not approved. You may reapply with a valid Level 3 certification.'
                  : 'Unlock professional terroir analysis fields. Requires a Level 3 certification from any recognized sommelier program (CMS, WSET, ISG, etc.).'}
              </Text>
            </View>

            {certSuccess && (
              <View style={styles.certSuccessBanner}>
                <Text style={styles.certSuccessText}>
                  Application submitted! Your certification is under review. You'll have access to professional features once approved.
                </Text>
              </View>
            )}

            {!certSuccess && (
              <>
                {!showSommelierApply ? (
                  <Button
                    label="Apply for Sommelier Status"
                    onPress={() => setShowSommelierApply(true)}
                    variant="secondary"
                  />
                ) : (
                  <View style={styles.applyForm}>
                    <SommelierCertUpload
                      onCertSelected={(uri, mime) => { setCertDataUrl(uri); setCertMime(mime); }}
                      certDataUrl={certDataUrl}
                      certMime={certMime}
                      uploading={certUploading}
                      error={certError}
                    />
                    <View style={styles.applyActions}>
                      <Button
                        label="Cancel"
                        onPress={() => { setShowSommelierApply(false); setCertDataUrl(null); setCertError(''); }}
                        variant="secondary"
                        style={styles.applyBtn}
                      />
                      <Button
                        label="Submit Application"
                        onPress={handleSommelierApply}
                        loading={certUploading}
                        style={styles.applyBtn}
                      />
                    </View>
                  </View>
                )}
              </>
            )}
          </View>
        )}

        {/* Pending notice */}
        {isSommelierPending && (
          <View style={styles.pendingCard}>
            <Text style={styles.pendingTitle}>Application Under Review</Text>
            <Text style={styles.pendingDesc}>
              Your Level 3 certification has been submitted and is being reviewed. You'll gain access to professional scoring fields once approved. This typically takes 2–3 business days.
            </Text>
          </View>
        )}

        {/* Approved sommelier features notice */}
        {isSommelierApproved && (
          <View style={styles.approvedCard}>
            <Text style={styles.approvedTitle}>Professional Features Unlocked</Text>
            {[
              'Terroir analysis (soil type & climate)',
              'Sommelier badge on your profile',
            ].map((item) => (
              <View key={item} style={styles.approvedItem}>
                <Text style={styles.approvedDot}>·</Text>
                <Text style={styles.approvedItemText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Subscription */}
        {SHOW_SUBSCRIPTION_UI && (
          <View style={styles.subsCard}>
            <View style={styles.subsHeader}>
              <View>
                <Text style={styles.subsLabel}>Current Plan</Text>
                <Text style={styles.subsTier}>
                  {isSubscribed ? '✨ Intelligence (Pro)' : '📓 Notebook (Free)'}
                </Text>
              </View>
              {isSubscribed && (
                <View style={styles.proBadge}>
                  <Text style={styles.proBadgeText}>PRO</Text>
                </View>
              )}
            </View>

            {!isSubscribed && (
              <View style={styles.upgradeBlock}>
                <Text style={styles.upgradeTitle}>Upgrade to Intelligence</Text>
                <Text style={styles.upgradeDesc}>
                  Full history • Taste fingerprint • Score vs. price chart{'\n'}
                  Compound search • Creator database • Recommendations
                </Text>
                {showUpgradeInfo ? (
                  <View style={styles.upgradeInfoBox}>
                    <Text style={styles.upgradeInfoText}>
                      Pour Across America Pro — $9.99/month or $79/year.{'\n\n'}
                      Subscription purchase will be available after App Store review.
                    </Text>
                    <Pressable onPress={() => setShowUpgradeInfo(false)}>
                      <Text style={styles.upgradeInfoClose}>Dismiss</Text>
                    </Pressable>
                  </View>
                ) : (
                  <Button
                    label="Upgrade — $9.99/mo"
                    onPress={() => setShowUpgradeInfo(true)}
                    style={styles.upgradeBtn}
                    size="md"
                  />
                )}
                <Text style={styles.upgradeAlt}>or $79/year (save 34%)</Text>
              </View>
            )}

            {isSubscribed && (
              <View style={styles.restoreBlock}>
                <Text style={styles.restoreText}>Restore purchase: checking your purchases…</Text>
              </View>
            )}
          </View>
        )}

        {/* Free tier details */}
        {SHOW_SUBSCRIPTION_UI && !isSubscribed && (
          <View style={styles.freeDetails}>
            <Text style={styles.freeDetailsTitle}>Free tier includes:</Text>
            {[
              'Unlimited wine entries',
              'Full scoring (Structure Wheel + Technical Score)',
              'Aroma wheel input',
              'Basic search (keyword + 3 filters)',
              'Last 30 wines browsable',
              'Basic analytics',
              'One shareable tasting card',
            ].map((item) => (
              <View key={item} style={styles.freeItem}>
                <Text style={styles.freeItemDot}>·</Text>
                <Text style={styles.freeItemText}>{item}</Text>
              </View>
            ))}
          </View>
        )}

        {/* Admin Panel — visible to is_creator users only */}
        {profile?.is_creator && (
          <Pressable
            style={styles.adminCard}
            onPress={() => navigation.navigate('Admin')}
          >
            <View style={styles.adminCardInner}>
              <View style={styles.adminCardLeft}>
                <Text style={styles.adminCardTitle}>Admin Panel</Text>
                <Text style={styles.adminCardSub}>Review Sommelier applications</Text>
              </View>
              <View style={styles.adminCardRight}>
                {pendingCount > 0 && (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{pendingCount}</Text>
                  </View>
                )}
                <Text style={styles.adminCardArrow}>›</Text>
              </View>
            </View>
          </Pressable>
        )}

        {/* App info */}
        <View style={styles.infoSection}>
          <Text style={styles.infoSectionTitle}>App Info</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoKey}>Version</Text>
            <Text style={styles.infoVal}>1.0.0</Text>
          </View>
        </View>

        {/* Sign out */}
        {confirmSignOut ? (
          <View style={styles.confirmBox}>
            <Text style={styles.confirmTitle}>Sign out?</Text>
            <Text style={styles.confirmSub}>You will need to sign in again to access your wines.</Text>
            <View style={styles.confirmActions}>
              <Button
                label="Cancel"
                onPress={() => setConfirmSignOut(false)}
                variant="secondary"
                style={styles.confirmBtn}
              />
              <Button
                label="Sign Out"
                onPress={signOut}
                variant="destructive"
                style={styles.confirmBtn}
              />
            </View>
          </View>
        ) : (
          <Button
            label="Sign Out"
            onPress={() => setConfirmSignOut(true)}
            variant="secondary"
            style={styles.signOutBtn}
          />
        )}

        {/* Danger Zone — Account Deletion (Apple Guideline 5.1.1(v)) */}
        <View style={styles.dangerZone}>
          <Text style={styles.dangerZoneTitle}>Danger Zone</Text>

          {confirmDelete ? (
            <View style={styles.deleteConfirmBox}>
              <Text style={styles.confirmTitle}>Delete your account?</Text>
              <Text style={styles.confirmSub}>This permanently deletes:</Text>
              <View style={styles.deleteList}>
                {[
                  'All tasting notes and wine entries',
                  'Messages and shared wine cards',
                  'Your sommelier certification status',
                  'Your profile and account',
                ].map((item) => (
                  <View key={item} style={styles.deleteListItem}>
                    <Text style={styles.deleteListDot}>·</Text>
                    <Text style={styles.deleteListText}>{item}</Text>
                  </View>
                ))}
              </View>

              {isSubscribed && (
                <Text style={styles.subscriptionWarning}>
                  This does not cancel your subscription. Manage or cancel it separately in
                  iPhone Settings → [Your Name] → Subscriptions.
                </Text>
              )}

              <Text style={styles.deleteTypeLabel}>Type DELETE to confirm</Text>
              <TextInput
                style={styles.deleteInput}
                value={deleteConfirmText}
                onChangeText={setDeleteConfirmText}
                autoCapitalize="characters"
                autoCorrect={false}
                placeholder="DELETE"
                placeholderTextColor={Colors.inkMuted}
              />

              <View style={styles.confirmActions}>
                <Button
                  label="Cancel"
                  onPress={() => { setConfirmDelete(false); setDeleteConfirmText(''); }}
                  variant="secondary"
                  style={styles.confirmBtn}
                />
                <Button
                  label="Delete My Account"
                  onPress={handleDeleteAccount}
                  variant="destructive"
                  loading={deleting}
                  disabled={deleteConfirmText.trim().toUpperCase() !== 'DELETE'}
                  style={styles.confirmBtn}
                />
              </View>
            </View>
          ) : (
            <Button
              label="Delete Account"
              onPress={() => setConfirmDelete(true)}
              variant="destructive"
              style={styles.deleteAccountBtn}
            />
          )}
        </View>
      </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.surface },
  content: {
    padding: Spacing.xl,
    paddingBottom: Spacing.huge,
    gap: Spacing.lg,
  },
  title: {
    fontFamily: Fonts.playfair,
    fontSize: 28,
    color: Colors.ink,
    marginBottom: Spacing.sm,
  },
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.lg,
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.gold,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontFamily: Fonts.playfair,
    fontSize: 20,
    color: Colors.ink,
  },
  avatarLoadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(31,21,24,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadge: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: Colors.ink,
    borderWidth: 1.5,
    borderColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarEditBadgeText: {
    fontSize: 10,
    color: Colors.white,
  },
  profileInfo: { flex: 1, gap: 2 },
  displayName: {
    fontFamily: Fonts.playfair,
    fontSize: 17,
    color: Colors.ink,
  },
  email: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  roleBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    marginTop: 4,
  },
  roleBadgeIcon: { fontSize: 13 },
  roleBadgeLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
  },
  verifiedPill: {
    backgroundColor: 'rgba(196,132,122,0.15)',
    borderRadius: Radius.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 0.5,
    borderColor: Colors.gold,
  },
  verifiedPillText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 10,
    color: Colors.gold,
    letterSpacing: 0.3,
  },
  pendingPill: {
    backgroundColor: 'rgba(255,193,7,0.12)',
    borderColor: '#FFC107',
  },
  pendingPillText: { color: '#996800' },
  rejectedPill: {
    backgroundColor: 'rgba(220,53,69,0.1)',
    borderColor: Colors.red,
  },
  rejectedPillText: { color: Colors.red },
  rejectionBanner: {
    backgroundColor: 'rgba(220,53,69,0.08)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.red,
    padding: Spacing.md,
    gap: 6,
  },
  rejectionBannerTitle: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.red,
    letterSpacing: 0.2,
  },
  rejectionBannerBody: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.ink,
    lineHeight: 19,
  },
  rejectionReasonCard: {
    backgroundColor: 'rgba(220,53,69,0.06)',
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.red,
    padding: Spacing.md,
    gap: 4,
  },
  rejectionReasonLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.red,
    opacity: 0.8,
  },
  rejectionReasonText: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.ink,
    lineHeight: 20,
  },
  resubmitPill: {
    backgroundColor: 'rgba(180,100,0,0.1)',
    borderColor: '#B46400',
  },
  resubmitPillText: { color: '#8B4D00' },
  resubmitReasonCard: {
    backgroundColor: 'rgba(180,100,0,0.06)',
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: '#B46400',
    padding: Spacing.md,
    gap: 4,
  },
  resubmitReasonLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: '#B46400',
    opacity: 0.9,
  },
  resubmitReasonText: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.ink,
    lineHeight: 20,
  },
  sommelierCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  sommelierHeader: { gap: 4 },
  sommelierTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 17,
    color: Colors.ink,
  },
  sommelierDesc: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    lineHeight: 18,
  },
  certSuccessBanner: {
    backgroundColor: 'rgba(40,167,69,0.1)',
    borderRadius: Radius.sm,
    padding: Spacing.md,
  },
  certSuccessText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: '#1a7a36',
    lineHeight: 18,
  },
  applyForm: { gap: Spacing.md },
  applyActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  applyBtn: { flex: 1 },
  pendingCard: {
    backgroundColor: 'rgba(255,193,7,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: '#FFC107',
    gap: 6,
  },
  pendingTitle: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 15,
    color: '#7a5200',
  },
  pendingDesc: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: '#7a5200',
    lineHeight: 18,
  },
  approvedCard: {
    backgroundColor: 'rgba(196,132,122,0.08)',
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.gold,
    gap: 6,
  },
  approvedTitle: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 15,
    color: Colors.gold,
    marginBottom: 4,
  },
  approvedItem: {
    flexDirection: 'row',
    gap: 8,
  },
  approvedDot: {
    color: Colors.gold,
    fontSize: 16,
    lineHeight: 20,
  },
  approvedItemText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMid,
    flex: 1,
    lineHeight: 20,
  },
  subsCard: {
    backgroundColor: Colors.ink,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.borderStrong,
    gap: Spacing.lg,
  },
  subsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  subsLabel: {
    fontFamily: Fonts.dmSans,
    fontSize: 11,
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: 'rgba(255,255,255,0.4)',
    marginBottom: 3,
  },
  subsTier: {
    fontFamily: Fonts.playfair,
    fontSize: 17,
    color: Colors.gold,
  },
  proBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: Radius.full,
    borderWidth: 0.5,
    borderColor: Colors.gold,
  },
  proBadgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 11,
    color: Colors.gold,
    letterSpacing: 0.5,
  },
  upgradeBlock: {
    gap: Spacing.sm,
  },
  upgradeTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 16,
    color: Colors.white,
  },
  upgradeDesc: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.45)',
    lineHeight: 18,
  },
  upgradeBtn: {
    width: '100%',
  },
  upgradeAlt: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: 'rgba(255,255,255,0.3)',
    textAlign: 'center',
  },
  upgradeInfoBox: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: Radius.sm,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  upgradeInfoText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.6)',
    lineHeight: 19,
  },
  upgradeInfoClose: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.gold,
    textAlign: 'right',
  },
  restoreBlock: {
    paddingTop: Spacing.sm,
  },
  restoreText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: 'rgba(255,255,255,0.4)',
    textAlign: 'center',
  },
  freeDetails: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: 6,
  },
  freeDetailsTitle: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 13,
    color: Colors.inkMid,
    marginBottom: 4,
  },
  freeItem: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'flex-start',
  },
  freeItemDot: {
    color: Colors.gold,
    fontSize: 16,
    lineHeight: 20,
  },
  freeItemText: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
    flex: 1,
    lineHeight: 20,
  },
  infoSection: {
    gap: Spacing.sm,
  },
  infoSectionTitle: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.inkMuted,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.border,
  },
  infoKey: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.inkMid,
  },
  infoVal: {
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.inkMuted,
  },
  adminCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
  },
  directoryCard: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  inviteRow: {
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  directoryToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: Spacing.md,
    borderTopWidth: 0.5,
    borderTopColor: Colors.border,
  },
  toggleInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    flex: 1,
  },
  toggleTitle: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 14,
    color: Colors.ink,
  },
  toggleSub: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: 2,
  },
  adminCardInner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  adminCardLeft: {
    flex: 1,
  },
  adminCardRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  badge: {
    backgroundColor: Colors.red,
    borderRadius: Radius.full,
    minWidth: 22,
    height: 22,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.white,
    lineHeight: 14,
  },
  adminCardTitle: {
    fontFamily: Fonts.playfairSemiBold,
    fontSize: 15,
    color: Colors.ink,
    marginBottom: 2,
  },
  adminCardSub: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  adminCardArrow: {
    fontFamily: Fonts.dmSansRegular,
    fontSize: 22,
    color: Colors.gold,
    lineHeight: 26,
  },
  signOutBtn: {
    marginTop: Spacing.md,
  },
  confirmBox: {
    backgroundColor: Colors.surfaceAlt,
    borderRadius: Radius.md,
    padding: Spacing.lg,
    borderWidth: 0.5,
    borderColor: Colors.border,
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  confirmTitle: {
    fontFamily: Fonts.playfair,
    fontSize: 18,
    color: Colors.ink,
  },
  confirmSub: {
    fontFamily: Fonts.dmSans,
    fontSize: 13,
    color: Colors.inkMuted,
  },
  confirmActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  confirmBtn: { flex: 1 },
  dangerZone: {
    marginTop: Spacing.xl,
    paddingTop: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: 'rgba(220,53,69,0.2)',
    gap: Spacing.md,
  },
  dangerZoneTitle: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    color: Colors.red,
    opacity: 0.7,
  },
  deleteAccountBtn: {
    borderColor: Colors.red,
  },
  deleteConfirmBox: {
    backgroundColor: 'rgba(220,53,69,0.05)',
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: Colors.red,
    padding: Spacing.lg,
    gap: Spacing.sm,
  },
  deleteList: { gap: 4, marginVertical: 4 },
  deleteListItem: { flexDirection: 'row', gap: 8 },
  deleteListDot: { color: Colors.red, fontSize: 16, lineHeight: 20 },
  deleteListText: { fontFamily: Fonts.dmSans, fontSize: 13, color: Colors.ink, flex: 1 },
  subscriptionWarning: {
    fontFamily: Fonts.dmSans,
    fontSize: 12,
    color: '#996800',
    backgroundColor: 'rgba(255,193,7,0.1)',
    padding: Spacing.sm,
    borderRadius: Radius.sm,
    lineHeight: 17,
  },
  deleteTypeLabel: {
    fontFamily: Fonts.dmSansMedium,
    fontSize: 12,
    color: Colors.inkMuted,
    marginTop: Spacing.sm,
  },
  deleteInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: Radius.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    fontFamily: Fonts.dmSans,
    fontSize: 14,
    color: Colors.ink,
    letterSpacing: 1,
  },
});
