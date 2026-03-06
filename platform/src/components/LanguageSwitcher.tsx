import { useTranslation } from 'react-i18next';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useEnabledLanguages } from '@/hooks/usePlatformLanguages';

export function LanguageSwitcher() {
  const { i18n } = useTranslation();
  const { data: languages } = useEnabledLanguages();

  const handleChange = (value: string) => {
    i18n.changeLanguage(value);
  };

  return (
    <Select value={i18n.language} onValueChange={handleChange}>
      <SelectTrigger className="w-[100px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {(languages || []).map((lang) => (
          <SelectItem key={lang.code} value={lang.code}>
            {lang.flag} {lang.label_native}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
