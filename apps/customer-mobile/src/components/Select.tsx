import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, ChevronDown, ChevronUp } from 'lucide-react-native';
import { colors, fonts } from '../lib/theme';

export type SelectOption = { value: string; label: string };

// Inline dropdown: the option list opens right under the field and pushes the
// content below it down, instead of covering the screen.
export function Select({
  value,
  options,
  placeholder,
  title,
  onChange,
  disabled,
}: {
  value: string | null;
  options: SelectOption[];
  placeholder: string;
  title: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);
  const Chevron = open ? ChevronUp : ChevronDown;

  return (
    <View>
      <Pressable
        style={[styles.field, open && styles.fieldOpen, disabled && styles.fieldDisabled]}
        onPress={() => setOpen(!open)}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}: ${selected?.label ?? placeholder}`}
      >
        <Text style={[styles.fieldText, !selected && styles.placeholder]} numberOfLines={1}>
          {selected?.label ?? placeholder}
        </Text>
        <Chevron size={18} color={open ? colors.accent : colors.textFaint} />
      </Pressable>

      {open ? (
        <View style={styles.list} accessibilityRole="list">
          {options.map((option, index) => {
            const isSelected = option.value === value;
            return (
              <Pressable
                key={option.value}
                style={({ pressed }) => [
                  styles.option,
                  index === options.length - 1 && styles.optionLast,
                  isSelected && styles.optionSelected,
                  pressed && styles.optionPressed,
                ]}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: isSelected }}
              >
                <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>{option.label}</Text>
                {isSelected ? <Check size={16} color={colors.accent} /> : null}
              </Pressable>
            );
          })}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  field: {
    minHeight: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.inputBorder,
    backgroundColor: colors.inputBackground,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  fieldOpen: {
    borderColor: colors.accent,
    borderBottomLeftRadius: 0,
    borderBottomRightRadius: 0,
    backgroundColor: colors.surface,
  },
  fieldDisabled: { opacity: 0.5 },
  fieldText: { flex: 1, fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  placeholder: { color: colors.textFaint },
  list: {
    borderWidth: 1,
    borderTopWidth: 0,
    borderColor: colors.accent,
    borderBottomLeftRadius: 12,
    borderBottomRightRadius: 12,
    backgroundColor: colors.surface,
    overflow: 'hidden',
  },
  option: {
    minHeight: 44,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  optionLast: { borderBottomWidth: 0 },
  optionSelected: { backgroundColor: colors.accentSoft },
  optionPressed: { backgroundColor: colors.surfaceRaised },
  optionText: { flex: 1, fontFamily: fonts.regular, fontSize: 14, color: colors.text },
  optionTextSelected: { color: colors.accent, fontFamily: fonts.bold },
});
