import { Feather } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import { router, useLocalSearchParams } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
  useColorScheme,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import Colors from "@/constants/colors";
import { useAccounts } from "@/context/AccountsContext";
import { useQueries } from "@/context/QueriesContext";

const WINDOW_HEIGHT = Dimensions.get("window").height;

const MOBILE_USER_AGENT =
  "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/112.0.0.0 Mobile Safari/537.36";

const BING_HOME = "https://www.bing.com";
const REWARDS_URL = "https://rewards.bing.com/";

type Phase = "searching" | "scraping" | "daily_set" | "done_all";

type SearchTask = {
  accountId: string;
  accountName: string;
  accountEmail: string;
  searchCount: number;
  dailySetEnabled: boolean;
  queries: string[];
  cookies: Record<string, string>;
};

function buildCookieInjectScript(cookies: Record<string, string>): string {
  const entries = Object.entries(cookies);
  if (entries.length === 0) return "true;";
  const lines = entries
    .map(([k, v]) => {
      const ek = k.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const ev = v.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return `try { document.cookie = '${ek}=${ev}; domain=.bing.com; path=/; SameSite=None; Secure'; } catch(e) {}`;
    })
    .join("\n");
  return `(function(){\n${lines}\nwindow.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({type:'COOKIES_INJECTED'}));\n})();\ntrue;`;
}

function getTypingScript(query: string): string {
  const escaped = query
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\r?\n/g, " ");

  return `
(function() {
  var q = '${escaped}';
  var attempts = 0;
  var maxAttempts = 40;

  function findInput() {
    // Primary: exact Bing search box id
    var primary = document.querySelector('input#sb_form_q');
    if (primary) return primary;
    // Fallbacks
    var byId = document.getElementById('q');
    if (byId && byId.tagName === 'INPUT') return byId;
    var byName = document.querySelector('input[name="q"], input[type="search"]');
    if (byName) return byName;
    // Last resort: any large visible input
    var all = document.querySelectorAll('input');
    for (var j = 0; j < all.length; j++) {
      var inp = all[j];
      if (inp.type !== 'hidden' && inp.type !== 'checkbox' && inp.type !== 'radio' && inp.type !== 'submit') {
        var rect = inp.getBoundingClientRect();
        if (rect.width > 100 && rect.height > 20) return inp;
      }
    }
    return null;
  }

  function dispatchKey(el, type, key, code, charCode) {
    try {
      el.dispatchEvent(new KeyboardEvent(type, {
        key: key, code: code, charCode: charCode,
        bubbles: true, cancelable: true
      }));
    } catch(e) {}
  }

  function doType(input) {
    input.focus();
    input.click();
    input.value = '';
    input.dispatchEvent(new Event('focus', { bubbles: true }));
    var pos = 0;
    var baseDelay = 120 + Math.floor(Math.random() * 60);

    function pressEnter(el) {
      el.dispatchEvent(new Event('change', { bubbles: true }));
      dispatchKey(el, 'keydown', 'Enter', 'Enter', 13);
      dispatchKey(el, 'keypress', 'Enter', 'Enter', 13);
      dispatchKey(el, 'keyup', 'Enter', 'Enter', 13);
    }

    function tick() {
      if (pos >= q.length) {
        setTimeout(function() {
          pressEnter(input);
          // Belt-and-suspenders: also submit the form if Enter doesn't navigate
          setTimeout(function() {
            if (window.location.href.indexOf('/search') === -1) {
              var form = input.form || document.getElementById('sb_form');
              if (form) { try { form.submit(); } catch(e) {} }
            }
          }, 1500);
        }, 500 + Math.floor(Math.random() * 300));
        return;
      }
      var ch = q[pos];
      var code = 'Key' + ch.toUpperCase();
      dispatchKey(input, 'keydown', ch, code, ch.charCodeAt(0));
      dispatchKey(input, 'keypress', ch, code, ch.charCodeAt(0));
      input.value = q.substring(0, pos + 1);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      dispatchKey(input, 'keyup', ch, code, ch.charCodeAt(0));
      pos++;
      var delay = baseDelay + Math.floor(Math.random() * 80) - 20;
      if (Math.random() < 0.08) delay += 200 + Math.floor(Math.random() * 300);
      setTimeout(tick, Math.max(60, delay));
    }

    setTimeout(tick, 400 + Math.floor(Math.random() * 300));
  }

  function tryFind() {
    var input = findInput();
    if (input) {
      doType(input);
      return;
    }
    attempts++;
    if (attempts < maxAttempts) {
      setTimeout(tryFind, 500);
    } else {
      window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'SEARCH_INPUT_NOT_FOUND' }));
    }
  }

  setTimeout(tryFind, 800);
})();
true;
`;
}

const SCRAPE_POINTS_JS = `
(function() {
  try {
    var pts = 0;
    // Try multiple selectors Microsoft uses
    var selectors = [
      '[data-testid="reward-points-amount"]',
      '.points-balance-amount',
      '.pointsTotal',
      '#rewardsBanner .pointsBalance',
      '.c-heading-3',
      '[class*="points"]',
    ];
    for (var i = 0; i < selectors.length; i++) {
      var el = document.querySelector(selectors[i]);
      if (el) {
        var txt = (el.innerText || el.textContent || '').replace(/[^0-9]/g, '');
        if (txt && parseInt(txt, 10) > 0) { pts = parseInt(txt, 10); break; }
      }
    }
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POINTS_SCRAPED', points: pts }));
  } catch(e) {
    window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'POINTS_SCRAPED', points: 0 }));
  }
})();
true;
`;

function getDailySetScript(): string {
  return `
(function() {
  var clicked = 0;
  var maxClicks = 3;

  function findCards() {
    // Exact selector provided by the user
    var primary = document.querySelectorAll('#daily-sets mee-card-group:nth-child(7) .ds-card-sec.ng-scope');
    if (primary.length > 0) return Array.from(primary).slice(0, maxClicks);

    // Broader fallbacks in case the page structure shifts
    var fallbacks = [
      '#daily-sets .ds-card-sec',
      '#daily-sets mee-card-group .ng-scope',
      '#daily-sets .c-card-content',
    ];
    for (var i = 0; i < fallbacks.length; i++) {
      var found = document.querySelectorAll(fallbacks[i]);
      if (found.length > 0) return Array.from(found).slice(0, maxClicks);
    }
    return [];
  }

  function clickNext(cards, idx) {
    if (idx >= cards.length || clicked >= maxClicks) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DAILY_SET_DONE', clicked: clicked }));
      return;
    }
    try {
      var card = cards[idx];
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function() {
        try { card.click(); } catch(e) {}
        clicked++;
        var wait = 5000 + Math.floor(Math.random() * 3000);
        setTimeout(function() { clickNext(cards, idx + 1); }, wait);
      }, 500);
    } catch(e) {
      clicked++;
      setTimeout(function() { clickNext(cards, idx + 1); }, 5000);
    }
  }

  setTimeout(function() {
    var cards = findCards();
    if (cards.length === 0) {
      window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DAILY_SET_DONE', clicked: 0 }));
    } else {
      clickNext(cards, 0);
    }
  }, 2000);
})();
true;
`;
}

const INJECTED_JS = `
(function() {
  try {
    window.ReactNativeWebView.postMessage(JSON.stringify({
      type: 'PAGE_LOADED',
      url: window.location.href
    }));
  } catch(e) {}
})();
true;
`;

export default function SearchRunnerScreen() {
  const scheme = useColorScheme() ?? "light";
  const colors = Colors[scheme];
  const insets = useSafeAreaInsets();
  const { accountIds: accountIdsParam } = useLocalSearchParams<{ accountIds: string }>();
  const { accounts, updateAccount, addLog, stopRun } = useAccounts();
  const { pickQueries } = useQueries();

  const [tasks, setTasks] = useState<SearchTask[]>([]);
  const [ready, setReady] = useState(false);
  const [minimized, setMinimized] = useState(false);
  const [isDone, setIsDone] = useState(false);
  const [webviewKey, setWebviewKey] = useState(0);
  const [webviewUri, setWebviewUri] = useState(BING_HOME);
  const [phase, setPhase] = useState<Phase>("searching");
  const [currentQuery, setCurrentQuery] = useState("");
  const [currentTaskIdx, setCurrentTaskIdx] = useState(0);
  const [currentQueryIdx, setCurrentQueryIdx] = useState(0);
  const [statusText, setStatusText] = useState("Starting...");

  const phaseRef = useRef<Phase>("searching");
  const currentTaskIdxRef = useRef(0);
  const currentQueryIdxRef = useRef(0);
  const stoppedRef = useRef(false);
  const delayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const webViewRef = useRef<any>(null);
  const pageLoadedRef = useRef(false);
  const tasksRef = useRef<SearchTask[]>([]);
  const dailySetDoneRef = useRef(false);
  const earnedPointsRef = useRef(0);
  const inputRetryCountRef = useRef(0);

  const slideAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const targetIds: string[] = JSON.parse(accountIdsParam ?? "[]");
    const targetAccounts = accounts.filter((a) => targetIds.includes(a.id));
    const newTasks: SearchTask[] = targetAccounts.map((acc) => {
      const picked = pickQueries(acc.searchCount);
      // Double-shuffle for truly random order each run
      const shuffled = picked
        .map((q) => ({ q, sort: Math.random() }))
        .sort((a, b) => a.sort - b.sort)
        .map(({ q }) => q);
      return {
        accountId: acc.id,
        accountName: acc.name,
        accountEmail: acc.email,
        searchCount: acc.searchCount,
        dailySetEnabled: acc.dailySetEnabled,
        queries: shuffled,
        cookies: acc.cookies ?? {},
      };
    });
    tasksRef.current = newTasks;
    setTasks(newTasks);

    newTasks.forEach((t) => {
      updateAccount(t.accountId, { status: "running", searchesCompleted: 0 });
    });

    if (newTasks.length > 0 && newTasks[0].queries.length > 0) {
      setCurrentQuery(newTasks[0].queries[0]);
      setStatusText("Injecting cookies...");
    }

    setReady(true);
    return () => {
      if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    };
  }, []);

  const totalSearches = tasks.reduce((sum, t) => sum + t.queries.length, 0);
  const completedSearches =
    tasks.slice(0, currentTaskIdx).reduce((sum, t) => sum + t.queries.length, 0) + currentQueryIdx;
  const progressPct = totalSearches > 0 ? completedSearches / totalSearches : 0;

  const finishAllDone = useCallback(() => {
    setIsDone(true);
    phaseRef.current = "done_all";
    setPhase("done_all");
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, []);

  const logAndAdvanceAccount = useCallback(
    (tIdx: number, points: number, dailySetDone: boolean) => {
      const allTasks = tasksRef.current;
      const task = allTasks[tIdx];
      if (!task) return;

      const pointsFields = points > 0 ? { todayPoints: points, totalPoints: points } : {};
      updateAccount(task.accountId, {
        status: "done",
        searchesCompleted: task.queries.length,
        lastRun: new Date().toISOString(),
        ...pointsFields,
      });

      addLog({
        accountId: task.accountId,
        accountName: task.accountName,
        timestamp: new Date().toISOString(),
        searchesDone: task.queries.length,
        dailySetDone,
        pointsEarned: points,
        status: "success",
      });

      const nextTIdx = tIdx + 1;
      if (nextTIdx < allTasks.length && !stoppedRef.current) {
        currentTaskIdxRef.current = nextTIdx;
        currentQueryIdxRef.current = 0;
        dailySetDoneRef.current = false;
        earnedPointsRef.current = 0;
        setCurrentTaskIdx(nextTIdx);
        setCurrentQueryIdx(0);
        const nextTask = allTasks[nextTIdx];
        setCurrentQuery(nextTask.queries[0]);
        updateAccount(nextTask.accountId, { status: "running", searchesCompleted: 0 });

        phaseRef.current = "searching";
        setPhase("searching");
        setWebviewUri(BING_HOME);
        setStatusText("Injecting cookies...");
        setWebviewKey((k) => k + 1);
      } else {
        finishAllDone();
      }
    },
    [updateAccount, addLog, finishAllDone]
  );

  const startScraping = useCallback(() => {
    if (stoppedRef.current) return;
    phaseRef.current = "scraping";
    setPhase("scraping");
    setStatusText("Checking points balance...");
    setWebviewUri(REWARDS_URL);
    setWebviewKey((k) => k + 1);
    pageLoadedRef.current = false;
  }, []);

  const goNext = useCallback(() => {
    if (stoppedRef.current) return;
    pageLoadedRef.current = false;
    inputRetryCountRef.current = 0;

    const tIdx = currentTaskIdxRef.current;
    const qIdx = currentQueryIdxRef.current;
    const allTasks = tasksRef.current;
    const task = allTasks[tIdx];
    if (!task) return;

    const nextQIdx = qIdx + 1;

    if (nextQIdx < task.queries.length) {
      currentQueryIdxRef.current = nextQIdx;
      setCurrentQueryIdx(nextQIdx);
      setCurrentQuery(task.queries[nextQIdx]);
      updateAccount(task.accountId, { searchesCompleted: nextQIdx });
      setWebviewUri(BING_HOME);
      setWebviewKey((k) => k + 1);
    } else {
      updateAccount(task.accountId, { searchesCompleted: task.queries.length });
      startScraping();
    }
  }, [updateAccount, startScraping]);

  const handleUrlChange = useCallback(
    (url: string) => {
      if (stoppedRef.current) return;

      const currentPhase = phaseRef.current;

      if (currentPhase === "searching") {
        const isResults =
          url.includes("bing.com/search") ||
          url.includes("bing.com/Search") ||
          (url.includes("bing.com") && url.includes("?q="));

        const isHome =
          !isResults &&
          (url.includes("bing.com") || url === "" || url.startsWith(BING_HOME));

        if (isResults) {
          if (pageLoadedRef.current) return;
          pageLoadedRef.current = true;
          // 5–8 second random wait on results page before next search
          const delay = 5000 + Math.random() * 3000;
          const secs = Math.round(delay / 1000);
          setStatusText(`Waiting ${secs}s before next search...`);
          delayTimerRef.current = setTimeout(goNext, delay);
        } else if (isHome) {
          pageLoadedRef.current = false;
          const task = tasksRef.current[currentTaskIdxRef.current];
          const query = task?.queries[currentQueryIdxRef.current];
          if (query && !stoppedRef.current) {
            setStatusText(`Typing: "${query.substring(0, 30)}..."`);
            setTimeout(() => {
              if (!stoppedRef.current && phaseRef.current === "searching") {
                webViewRef.current?.injectJavaScript(getTypingScript(query));
              }
            }, 600);
          }
        }
      } else if (currentPhase === "scraping") {
        const isRewards = url.includes("rewards.bing.com") || url.includes("bing.com/rewards");
        if (isRewards && !pageLoadedRef.current) {
          pageLoadedRef.current = true;
          setTimeout(() => {
            if (!stoppedRef.current && phaseRef.current === "scraping") {
              webViewRef.current?.injectJavaScript(SCRAPE_POINTS_JS);
            }
          }, 2000);
        }
      }
    },
    [goNext]
  );

  const handleMessage = useCallback(
    (event: any) => {
      try {
        const data = JSON.parse(event.nativeEvent.data);

        if (data.type === "PAGE_LOADED") {
          handleUrlChange(data.url ?? "");
        } else if (data.type === "COOKIES_INJECTED") {
          const task = tasksRef.current[currentTaskIdxRef.current];
          if (task && phaseRef.current === "searching") {
            const query = task.queries[currentQueryIdxRef.current];
            if (query) {
              setStatusText(`Typing: "${query.substring(0, 30)}..."`);
            }
          }
        } else if (data.type === "POINTS_SCRAPED") {
          const pts = typeof data.points === "number" ? data.points : 0;
          earnedPointsRef.current = pts;
          const tIdx = currentTaskIdxRef.current;
          const task = tasksRef.current[tIdx];

          if (task?.dailySetEnabled) {
            phaseRef.current = "daily_set";
            setPhase("daily_set");
            setStatusText("Completing Daily Set...");
            pageLoadedRef.current = false;
            setTimeout(() => {
              if (!stoppedRef.current) {
                webViewRef.current?.injectJavaScript(getDailySetScript());
              }
            }, 1000);
          } else {
            logAndAdvanceAccount(tIdx, pts, false);
          }
        } else if (data.type === "DAILY_SET_DONE") {
          const tIdx = currentTaskIdxRef.current;
          const clicked = typeof data.clicked === "number" ? data.clicked : 0;
          logAndAdvanceAccount(tIdx, earnedPointsRef.current, clicked > 0);
        } else if (data.type === "SEARCH_INPUT_NOT_FOUND" || data.type === "SEARCH_SUBMIT_FAILED") {
          if (stoppedRef.current || phaseRef.current !== "searching") return;
          inputRetryCountRef.current += 1;
          if (inputRetryCountRef.current <= 3) {
            // Reload bing home and try again for this query
            setStatusText("Reloading search page...");
            pageLoadedRef.current = false;
            setWebviewUri(BING_HOME);
            setWebviewKey((k) => k + 1);
          } else {
            // Give up on this query and skip to next after too many reloads
            inputRetryCountRef.current = 0;
            setStatusText("Skipping query...");
            setTimeout(() => goNext(), 1000);
          }
        }
      } catch (_) {}
    },
    [handleUrlChange, logAndAdvanceAccount, goNext]
  );

  const handleLoadEnd = useCallback(
    (e?: any) => {
      const url: string = e?.nativeEvent?.url ?? "";
      const currentPhase = phaseRef.current;

      if (currentPhase === "searching") {
        const isResults =
          url.includes("bing.com/search") ||
          url.includes("bing.com/Search") ||
          (url.includes("bing.com") && url.includes("?q="));
        const isBing = url.includes("bing.com") || url === "";

        if (isBing && !isResults) {
          // Home page — inject cookies first, then detect URL
          const task = tasksRef.current[currentTaskIdxRef.current];
          if (task && Object.keys(task.cookies).length > 0) {
            webViewRef.current?.injectJavaScript(buildCookieInjectScript(task.cookies));
          }
          webViewRef.current?.injectJavaScript(INJECTED_JS);
        } else if (isResults) {
          // Results page — just detect URL, no cookie injection needed
          webViewRef.current?.injectJavaScript(INJECTED_JS);
        } else {
          handleUrlChange(url);
        }
      } else {
        handleUrlChange(url);
      }
    },
    [handleUrlChange]
  );

  const handleStop = () => {
    stoppedRef.current = true;
    if (delayTimerRef.current) clearTimeout(delayTimerRef.current);
    tasksRef.current.forEach((t, i) => {
      if (i >= currentTaskIdxRef.current) {
        updateAccount(t.accountId, { status: "idle", searchesCompleted: 0 });
      }
    });
    stopRun();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    router.back();
  };

  const handleMinimize = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMinimized(true);
    Animated.spring(slideAnim, {
      toValue: WINDOW_HEIGHT,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const handleExpand = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setMinimized(false);
    Animated.spring(slideAnim, {
      toValue: 0,
      useNativeDriver: true,
      tension: 80,
      friction: 12,
    }).start();
  };

  const currentTask = tasks[currentTaskIdx];

  const phaseLabel = () => {
    if (phase === "scraping") return "Checking points...";
    if (phase === "daily_set") return "Daily Set";
    return "Searching Bing";
  };

  if (Platform.OS === "web") {
    return (
      <View style={[styles.webFallback, { backgroundColor: colors.background }]}>
        <Feather name="monitor" size={48} color={colors.textMuted} />
        <Text style={[styles.webFallbackTitle, { color: colors.text }]}>Open on Android/iOS</Text>
        <Text style={[styles.webFallbackSub, { color: colors.textSecondary }]}>
          Real Bing searches require a native device with Expo Go.
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: colors.tint }]}>
          <Text style={styles.closeBtnText}>Close</Text>
        </Pressable>
      </View>
    );
  }

  const WebViewComponent = require("react-native-webview").default;

  if (!ready || tasks.length === 0) {
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.background }]}>
        <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
          {tasks.length === 0 ? "No accounts to run." : "Preparing searches..."}
        </Text>
        <Pressable onPress={() => router.back()} style={[styles.closeBtn, { backgroundColor: colors.tint, marginTop: 16 }]}>
          <Text style={styles.closeBtnText}>Go Back</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.overlay} pointerEvents="box-none">
      {!minimized && (
        <Pressable style={styles.backdrop} onPress={handleMinimize} />
      )}

      <Animated.View
        style={[
          styles.card,
          {
            backgroundColor: colors.background,
            paddingBottom: insets.bottom + 16,
            transform: [{ translateY: slideAnim }],
          },
        ]}
      >
        <LinearGradient
          colors={phase === "daily_set" ? ["#7C3AED", "#6D28D9"] : phase === "scraping" ? ["#059669", "#047857"] : ["#1D4ED8", "#2563EB"]}
          style={styles.cardHeader}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        >
          <View style={styles.headerLeft}>
            <View style={[styles.headerDot, { backgroundColor: isDone ? "#22C55E" : "#4ADE80" }]} />
            <View>
              <Text style={styles.headerTitle}>
                {isDone ? "All done!" : phaseLabel()}
              </Text>
              {currentTask && !isDone && (
                <Text style={styles.headerSub} numberOfLines={1}>
                  {currentTask.accountEmail} — Account {currentTaskIdx + 1}/{tasks.length}
                </Text>
              )}
            </View>
          </View>
          <View style={styles.headerActions}>
            <Pressable
              onPress={handleMinimize}
              style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="minus" size={18} color="rgba(255,255,255,0.9)" />
            </Pressable>
            <Pressable
              onPress={handleStop}
              style={({ pressed }) => [styles.headerBtn, { opacity: pressed ? 0.7 : 1 }]}
            >
              <Feather name="x" size={18} color="rgba(255,255,255,0.9)" />
            </Pressable>
          </View>
        </LinearGradient>

        <View style={styles.progressSection}>
          <View style={styles.progressRow}>
            <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>
              {phase === "scraping"
                ? "Fetching rewards balance"
                : phase === "daily_set"
                ? "Completing Daily Set"
                : `Search ${Math.min(completedSearches + 1, totalSearches)} of ${totalSearches}`}
            </Text>
            <Text style={[styles.progressPct, { color: colors.tint }]}>
              {Math.round(progressPct * 100)}%
            </Text>
          </View>
          <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
            <View
              style={[
                styles.progressFill,
                { backgroundColor: colors.tint, width: `${progressPct * 100}%` },
              ]}
            />
          </View>
          <Text style={[styles.currentQuery, { color: colors.textMuted }]} numberOfLines={1}>
            {statusText}
          </Text>
        </View>

        <View style={styles.webviewContainer}>
          {isDone ? (
            <View style={[styles.doneScreen, { backgroundColor: colors.surface }]}>
              <View style={[styles.doneIcon, { backgroundColor: "#F0FDF4" }]}>
                <Feather name="check-circle" size={40} color="#22C55E" />
              </View>
              <Text style={[styles.doneTitle, { color: colors.text }]}>All searches complete!</Text>
              <Text style={[styles.doneSub, { color: colors.textSecondary }]}>
                {totalSearches} searches across {tasks.length} account{tasks.length !== 1 ? "s" : ""}.
              </Text>
              <Pressable
                onPress={() => { stopRun(); router.back(); }}
                style={[styles.doneBtn, { backgroundColor: colors.tint }]}
              >
                <Text style={styles.doneBtnText}>Close</Text>
              </Pressable>
            </View>
          ) : (
            <WebViewComponent
              key={webviewKey}
              ref={webViewRef}
              source={{ uri: webviewUri }}
              userAgent={MOBILE_USER_AGENT}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              javaScriptEnabled
              domStorageEnabled
              cacheEnabled={false}
              style={styles.webview}
              onLoadEnd={handleLoadEnd}
              onMessage={handleMessage}
              onShouldStartLoadWithRequest={(req: any) => {
                const u: string = req.url;
                return (
                  u.includes("bing.com") ||
                  u.includes("microsoft.com") ||
                  u.includes("live.com") ||
                  u.startsWith("about:")
                );
              }}
            />
          )}
        </View>
      </Animated.View>

      {minimized && (
        <View style={[styles.pill, { bottom: insets.bottom + 24, backgroundColor: phase === "daily_set" ? "#7C3AED" : phase === "scraping" ? "#059669" : "#1D4ED8" }]}>
          <Pressable style={styles.pillContent} onPress={handleExpand}>
            <View style={[styles.pillDot, { backgroundColor: isDone ? "#22C55E" : "#60A5FA" }]} />
            <Text style={styles.pillText} numberOfLines={1}>
              {isDone
                ? `Done — ${totalSearches} searches`
                : phase === "scraping"
                ? `${currentTask?.accountEmail ?? "Running"} · Checking points`
                : phase === "daily_set"
                ? `${currentTask?.accountEmail ?? "Running"} · Daily Set`
                : `${currentTask?.accountEmail ?? "Running"} · ${completedSearches}/${totalSearches}`}
            </Text>
            <View style={[styles.pillProgress, { backgroundColor: "rgba(255,255,255,0.2)" }]}>
              <View
                style={[
                  styles.pillProgressFill,
                  { width: `${progressPct * 100}%`, backgroundColor: "#60A5FA" },
                ]}
              />
            </View>
            <Feather name="chevron-up" size={14} color="rgba(255,255,255,0.8)" />
          </Pressable>
          <Pressable onPress={handleStop} style={styles.pillStop}>
            <Feather name="x" size={14} color="rgba(255,255,255,0.7)" />
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.55)",
  },
  card: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 20,
    maxHeight: WINDOW_HEIGHT * 0.88,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 16,
    paddingTop: 20,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  headerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  headerTitle: {
    fontSize: 16,
    fontFamily: "Inter_700Bold",
    color: "#fff",
  },
  headerSub: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    color: "rgba(255,255,255,0.7)",
    marginTop: 1,
  },
  headerActions: {
    flexDirection: "row",
    gap: 8,
  },
  headerBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  progressSection: {
    paddingHorizontal: 20,
    paddingVertical: 14,
    gap: 8,
  },
  progressRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  progressLabel: {
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    flex: 1,
    marginRight: 8,
  },
  progressPct: {
    fontSize: 13,
    fontFamily: "Inter_700Bold",
  },
  progressTrack: {
    height: 6,
    borderRadius: 3,
    overflow: "hidden",
  },
  progressFill: {
    height: 6,
    borderRadius: 3,
  },
  currentQuery: {
    fontSize: 12,
    fontFamily: "Inter_400Regular",
    marginTop: 2,
  },
  webviewContainer: {
    height: 380,
  },
  webview: {
    flex: 1,
  },
  doneScreen: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  doneIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  doneTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  doneSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  doneBtn: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 24,
    marginTop: 8,
  },
  doneBtnText: {
    color: "#fff",
    fontSize: 16,
    fontFamily: "Inter_600SemiBold",
  },
  pill: {
    position: "absolute",
    left: 16,
    right: 16,
    borderRadius: 28,
    flexDirection: "row",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 16,
  },
  pillContent: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  pillDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  pillText: {
    flex: 1,
    fontSize: 13,
    fontFamily: "Inter_500Medium",
    color: "#fff",
  },
  pillProgress: {
    width: 48,
    height: 4,
    borderRadius: 2,
    overflow: "hidden",
  },
  pillProgressFill: {
    height: 4,
    borderRadius: 2,
  },
  pillStop: {
    paddingRight: 16,
    paddingVertical: 14,
  },
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 40,
  },
  webFallbackTitle: {
    fontSize: 20,
    fontFamily: "Inter_700Bold",
    textAlign: "center",
  },
  webFallbackSub: {
    fontSize: 14,
    fontFamily: "Inter_400Regular",
    textAlign: "center",
    lineHeight: 20,
  },
  closeBtn: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 20,
    marginTop: 8,
  },
  closeBtnText: {
    color: "#fff",
    fontSize: 15,
    fontFamily: "Inter_600SemiBold",
  },
  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
  },
  loadingText: {
    fontSize: 15,
    fontFamily: "Inter_400Regular",
  },
});
