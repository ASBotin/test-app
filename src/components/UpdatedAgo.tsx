import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';

type Props = {
  // Момент последней успешной загрузки данных.
  since: Date;
};

// Подпись «Обновлено N сек назад».
export function UpdatedAgo({ since }: Props) {
  const [seconds, setSeconds] = useState(() => getElapsedSeconds(since));

  useEffect(() => {
    const updateSeconds = () => setSeconds(getElapsedSeconds(since));
    updateSeconds();

    const intervalId = setInterval(updateSeconds, 1000);
    return () => clearInterval(intervalId);
  }, [since]);

  return <Text style={styles.text}>Обновлено {seconds} сек назад</Text>;
}

function getElapsedSeconds(since: Date) {
  return Math.max(0, Math.floor((Date.now() - since.getTime()) / 1000));
}

const styles = StyleSheet.create({
  text: {
    fontSize: 13,
    color: '#6b7280',
  },
});
