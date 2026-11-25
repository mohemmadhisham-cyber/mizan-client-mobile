import { View } from 'react-native';

import { FieldBack, HORIZON_GUTTER, HorizonScreen } from '@/components/horizon/horizon-screen';
import { SectionLabel } from '@/components/horizon/ruled';
import { Text } from '@/components/ui';
import { useTheme } from '@/theme';
import { horizonColors } from '@/theme/horizon';

const LEGAL_FIELD = 150;

interface LegalDocViewProps {
  title: string;
  sections: { heading: string; body: string }[];
}

/** A policy to read: the title in the field, then each section under its heading. */
export function LegalDocView({ title, sections }: LegalDocViewProps) {
  const theme = useTheme();
  const colors = horizonColors(theme.colors);

  return (
    <HorizonScreen
      field={LEGAL_FIELD}
      small
      lines={[{ text: title }]}
      top={<FieldBack colors={colors} />}
      // Something to read: nothing here is waiting for the person.
      bridge={null}>
      {sections.map((s) => (
        <View key={s.heading}>
          <SectionLabel>{s.heading}</SectionLabel>
          {/* Set at full strength: a policy is for reading, and quiet text over a long page tires the eye. */}
          <View style={{ paddingHorizontal: HORIZON_GUTTER }}>
            <Text variant="callout">{s.body}</Text>
          </View>
        </View>
      ))}
    </HorizonScreen>
  );
}
