import * as Haptics from "expo-haptics";

// Thin wrappers so call sites read as intent ("light tap", "success") rather
// than raw expo-haptics enum values. No-ops safely on web/unsupported
// devices — expo-haptics already resolves quietly there.
export const hapticTap = () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
export const hapticSuccess = () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
