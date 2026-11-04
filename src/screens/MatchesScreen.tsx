import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { FavoriteButton } from '../components/FavoriteButton';
import { UpdatedAgo } from '../components/UpdatedAgo';
import { MATCHES_URL } from '../config';
import { useFavorites } from '../hooks/useFavorites';

type MatchStatus = 'finished' | 'live' | 'scheduled' | 'postponed';

type Match = {
  id: string;
  startsAt: string | null;
  status: string;
  home: { id: string; name: string };
  away: { id: string; name: string };
  score: { home: number; away: number } | null;
  minute?: number;
};

type Filter = 'all' | 'upcoming' | 'finished' | 'favorites';

const filters: { key: Filter; label: string }[] = [
  { key: 'all', label: 'Все' },
  { key: 'upcoming', label: 'Предстоящие' },
  { key: 'finished', label: 'Завершённые' },
  { key: 'favorites', label: 'Избранные' },
];

const statusLabels: Record<MatchStatus, string> = {
  finished: 'Завершён',
  live: 'Идёт',
  scheduled: 'Предстоит',
  postponed: 'Перенесён',
};

export function MatchesScreen() {
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const { isFavorite, toggle } = useFavorites();

  const loadMatches = useCallback(async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(MATCHES_URL);
      if (!response.ok) {
        throw new Error(`Ошибка загрузки: ${response.status}`);
      }

      const data: unknown = await response.json();
      if (!isMatchesResponse(data)) {
        throw new Error('Сервер вернул данные в неверном формате');
      }

      setMatches(data.matches);
      setUpdatedAt(new Date());
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : 'Не удалось загрузить матчи',
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadMatches();
  }, [loadMatches]);

  const visibleMatches = (matches ?? []).filter((match) => {
    if (filter === 'upcoming') return match.status === 'scheduled';
    if (filter === 'finished') return match.status === 'finished';
    if (filter === 'favorites') return isFavorite(match.id);
    return true;
  });

  if (loading && matches === null) {
    return (
      <View style={styles.state}>
        <ActivityIndicator size="large" color="#2563eb" />
        <Text style={styles.stateText}>Загружаем матчи…</Text>
      </View>
    );
  }

  if (matches === null) {
    return (
      <View style={styles.state}>
        <Text style={styles.stateTitle}>Не удалось загрузить матчи</Text>
        <Text style={styles.errorText}>{error}</Text>
        <Pressable
          accessibilityRole="button"
          onPress={() => void loadMatches()}
          style={styles.primaryButton}
        >
          <Text style={styles.primaryButtonText}>Повторить</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Матчи тура</Text>
          {updatedAt && <UpdatedAgo since={updatedAt} />}
        </View>
        <Pressable
          accessibilityRole="button"
          disabled={loading}
          onPress={() => void loadMatches()}
          style={[styles.refreshButton, loading && styles.disabledButton]}
        >
          <Text style={styles.refreshButtonText}>
            {loading ? 'Обновление…' : 'Обновить'}
          </Text>
        </Pressable>
      </View>

      {error && <Text style={styles.inlineError}>{error}</Text>}

      <View style={styles.filters}>
        {filters.map((item) => {
          const selected = filter === item.key;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="button"
              accessibilityState={{ selected }}
              onPress={() => setFilter(item.key)}
              style={[styles.filterButton, selected && styles.selectedFilter]}
            >
              <Text
                style={[
                  styles.filterText,
                  selected && styles.selectedFilterText,
                ]}
              >
                {item.label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <FlatList
        data={visibleMatches}
        keyExtractor={(match) => match.id}
        contentContainerStyle={
          visibleMatches.length === 0 ? styles.emptyList : styles.list
        }
        ListEmptyComponent={
          <Text style={styles.stateText}>
            {matches.length === 0
              ? 'Матчей пока нет'
              : filter === 'favorites'
                ? 'В избранном пока нет матчей'
                : 'По этому фильтру матчей нет'}
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.matchCard}>
            <View style={styles.matchTop}>
              <Text style={styles.matchStatus}>
                {getStatusLabel(item.status)}
                {item.status === 'live' &&
                  typeof item.minute === 'number' &&
                  ` · ${item.minute}′`}
              </Text>
              <FavoriteButton
                active={isFavorite(item.id)}
                onPress={() => toggle(item.id)}
              />
            </View>

            <View style={styles.teams}>
              <Text style={styles.teamName}>{item.home.name}</Text>
              <Text style={styles.score}>{formatScore(item.score)}</Text>
              <Text style={styles.teamName}>{item.away.name}</Text>
            </View>

            <Text style={styles.matchDate}>
              {formatStartDate(item.startsAt)}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

function isMatchesResponse(value: unknown): value is { matches: Match[] } {
  if (
    typeof value !== 'object' ||
    value === null ||
    !('matches' in value) ||
    !Array.isArray(value.matches)
  ) {
    return false;
  }

  return value.matches.every(
    (match) =>
      typeof match === 'object' &&
      match !== null &&
      typeof match.id === 'string' &&
      (typeof match.startsAt === 'string' || match.startsAt === null) &&
      typeof match.status === 'string' &&
      typeof match.home?.name === 'string' &&
      typeof match.away?.name === 'string' &&
      (match.score === null ||
        (typeof match.score?.home === 'number' &&
          typeof match.score?.away === 'number')),
  );
}

function getStatusLabel(status: string) {
  if (Object.prototype.hasOwnProperty.call(statusLabels, status)) {
    return statusLabels[status as MatchStatus];
  }
  return 'Статус уточняется';
}

function formatScore(score: Match['score']) {
  return score ? `${score.home} : ${score.away}` : '—';
}

function formatStartDate(startsAt: string | null) {
  if (!startsAt) return 'Дата и время уточняются';

  const date = new Date(startsAt);
  if (Number.isNaN(date.getTime())) return 'Дата и время уточняются';

  const day = date.toLocaleDateString('ru-RU', {
    day: 'numeric',
    month: 'long',
  });
  const time = date.toLocaleTimeString('ru-RU', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${day}, ${time}`;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 16,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  refreshButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  disabledButton: {
    opacity: 0.6,
  },
  refreshButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
  inlineError: {
    color: '#b91c1c',
    marginBottom: 12,
  },
  filters: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    borderColor: '#d1d5db',
    borderRadius: 18,
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  selectedFilter: {
    backgroundColor: '#1d4ed8',
    borderColor: '#1d4ed8',
  },
  filterText: {
    color: '#374151',
    fontSize: 14,
  },
  selectedFilterText: {
    color: '#fff',
    fontWeight: '600',
  },
  list: {
    paddingBottom: 16,
  },
  emptyList: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  matchCard: {
    backgroundColor: '#fff',
    borderColor: '#e5e7eb',
    borderRadius: 12,
    borderWidth: 1,
    marginBottom: 12,
    padding: 16,
  },
  matchTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  matchStatus: {
    color: '#6b7280',
    fontSize: 13,
    fontWeight: '600',
  },
  teams: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  teamName: {
    flex: 1,
    color: '#111827',
    fontSize: 16,
    fontWeight: '600',
  },
  score: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
  },
  matchDate: {
    color: '#6b7280',
    fontSize: 13,
    marginTop: 12,
  },
  state: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  stateTitle: {
    color: '#111827',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 8,
    textAlign: 'center',
  },
  stateText: {
    color: '#6b7280',
    marginTop: 12,
    textAlign: 'center',
  },
  errorText: {
    color: '#b91c1c',
    marginBottom: 16,
    textAlign: 'center',
  },
  primaryButton: {
    backgroundColor: '#2563eb',
    borderRadius: 8,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  primaryButtonText: {
    color: '#fff',
    fontWeight: '600',
  },
});
