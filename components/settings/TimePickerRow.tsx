import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Modal, Platform } from 'react-native';
import DateTimePicker, {
  type DateTimePickerEvent,
} from '@react-native-community/datetimepicker';
import { SettingsRow } from './SettingsRow';

interface TimePickerRowProps {
  value: string; // "HH:MM"
  onChange: (value: string) => void;
}

function hmToDate(hm: string): Date {
  const [h, m] = hm.split(':').map(n => parseInt(n, 10));
  const d = new Date();
  d.setHours(Number.isFinite(h) ? h : 20, Number.isFinite(m) ? m : 0, 0, 0);
  return d;
}

function dateToHm(d: Date): string {
  const h = String(d.getHours()).padStart(2, '0');
  const m = String(d.getMinutes()).padStart(2, '0');
  return `${h}:${m}`;
}

export function TimePickerRow({ value, onChange }: TimePickerRowProps) {
  const [show, setShow] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selected?: Date) => {
    if (Platform.OS === 'android') {
      setShow(false);
      if (event.type === 'set' && selected) onChange(dateToHm(selected));
    } else if (selected) {
      // iOS: atualiza ao vivo enquanto o spinner gira.
      onChange(dateToHm(selected));
    }
  };

  return (
    <>
      <SettingsRow
        icon="time"
        iconColor="#7cc6ff"
        title="Horário do lembrete"
        value={value}
        onPress={() => setShow(true)}
      />

      {/* Android: diálogo nativo */}
      {Platform.OS === 'android' && show && (
        <DateTimePicker
          value={hmToDate(value)}
          mode="time"
          is24Hour
          onChange={handleChange}
        />
      )}

      {/* iOS: bottom sheet com spinner + Concluir */}
      {Platform.OS === 'ios' && (
        <Modal visible={show} transparent animationType="slide">
          <View className="flex-1 justify-end bg-black/40">
            <View className="bg-surface-container-high rounded-t-3xl pb-8">
              <View className="flex-row justify-between items-center px-5 py-3 border-b border-outline-variant/20">
                <Text className="text-on-surface font-jakarta-bold text-base">
                  Horário do lembrete
                </Text>
                <TouchableOpacity onPress={() => setShow(false)}>
                  <Text className="text-primary font-inter-semibold text-base">
                    Concluir
                  </Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={hmToDate(value)}
                mode="time"
                is24Hour
                display="spinner"
                themeVariant="dark"
                onChange={handleChange}
                style={{ alignSelf: 'center' }}
              />
            </View>
          </View>
        </Modal>
      )}
    </>
  );
}
