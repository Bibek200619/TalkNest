import { useEffect, useRef } from "react";
import { Animated, Easing, StyleSheet, View } from "react-native";
import { MessageCircle } from "lucide-react-native";

export function AnimatedSignal() {
  const spin = useRef(new Animated.Value(0)).current;
  const float = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const spinLoop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 9000,
        easing: Easing.linear,
        useNativeDriver: true
      })
    );
    const floatLoop = Animated.loop(
      Animated.sequence([
        Animated.timing(float, {
          toValue: 1,
          duration: 1900,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true
        }),
        Animated.timing(float, {
          toValue: 0,
          duration: 1900,
          easing: Easing.inOut(Easing.cubic),
          useNativeDriver: true
        })
      ])
    );

    spinLoop.start();
    floatLoop.start();

    return () => {
      spinLoop.stop();
      floatLoop.stop();
    };
  }, [float, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"]
  });
  const translateY = float.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -10]
  });

  return (
    <View style={styles.stage} pointerEvents="none">
      <Animated.View
        style={[
          styles.orbit,
          {
            transform: [{ perspective: 700 }, { rotateX: "58deg" }, { rotateZ: rotate }]
          }
        ]}
      >
        <View style={[styles.node, styles.nodeCoral]} />
        <View style={[styles.node, styles.nodeGold]} />
        <View style={[styles.node, styles.nodeBlue]} />
      </Animated.View>
      <Animated.View
        style={[
          styles.core,
          {
            transform: [{ translateY }]
          }
        ]}
      >
        <MessageCircle color="#f8faf7" size={38} strokeWidth={2.4} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: {
    alignItems: "center",
    height: 180,
    justifyContent: "center",
    marginBottom: 12,
    width: "100%"
  },
  orbit: {
    borderColor: "rgba(39, 115, 99, 0.24)",
    borderRadius: 90,
    borderWidth: 1,
    height: 150,
    position: "absolute",
    width: 150
  },
  node: {
    borderRadius: 14,
    height: 28,
    position: "absolute",
    width: 28
  },
  nodeCoral: {
    backgroundColor: "#e87054",
    left: 18,
    top: 14
  },
  nodeGold: {
    backgroundColor: "#e0b84e",
    right: 4,
    top: 62
  },
  nodeBlue: {
    backgroundColor: "#4b88a2",
    bottom: 12,
    left: 56
  },
  core: {
    alignItems: "center",
    backgroundColor: "#143f37",
    borderColor: "#dff0ea",
    borderRadius: 36,
    borderWidth: 4,
    height: 72,
    justifyContent: "center",
    shadowColor: "#0b1d18",
    shadowOffset: { width: 0, height: 18 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    width: 72
  }
});
