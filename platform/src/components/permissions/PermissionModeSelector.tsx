import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { PermissionMode } from "@/lib/permissionConfig";

interface PermissionModeSelectorProps {
  value: PermissionMode;
  supportedModes: PermissionMode[];
  onChange: (mode: PermissionMode) => void;
  disabled?: boolean;
}

const modeLabels: Record<PermissionMode, string> = {
  always_allow: '总是允许',
  allow_while_using: '使用时允许',
  allow_once: '允许一次',
  ask_every_time: '每次询问',
  never_allow: '不允许'
};

export function PermissionModeSelector({ 
  value, 
  supportedModes, 
  onChange, 
  disabled 
}: PermissionModeSelectorProps) {
  // 如果只支持两种模式，使用简洁的显示
  if (supportedModes.length === 2 && 
      supportedModes.includes('always_allow') && 
      supportedModes.includes('never_allow')) {
    return (
      <Select 
        value={value} 
        onValueChange={onChange as (value: string) => void}
        disabled={disabled}
      >
        <SelectTrigger className="w-[120px] h-9">
          <SelectValue>
            {value === 'always_allow' ? '允许' : '禁止'}
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="always_allow">允许</SelectItem>
          <SelectItem value="never_allow">禁止</SelectItem>
        </SelectContent>
      </Select>
    );
  }

  // 完整模式选择器
  return (
    <Select 
      value={value} 
      onValueChange={onChange as (value: string) => void}
      disabled={disabled}
    >
      <SelectTrigger className="w-[140px] h-9">
        <SelectValue>
          {modeLabels[value]}
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {supportedModes.map(mode => (
          <SelectItem key={mode} value={mode}>
            {modeLabels[mode]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
