import { useState } from "react";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Calendar as CalendarIcon, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

interface SchedulePostPickerProps {
  value: Date | null;
  onChange: (date: Date | null) => void;
  disabled?: boolean;
}

export function SchedulePostPicker({
  value,
  onChange,
  disabled,
}: SchedulePostPickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(
    value || undefined
  );
  const [selectedHour, setSelectedHour] = useState<string>(
    value ? format(value, "HH") : "12"
  );
  const [selectedMinute, setSelectedMinute] = useState<string>(
    value ? format(value, "mm") : "00"
  );

  const handleConfirm = () => {
    if (selectedDate) {
      const date = new Date(selectedDate);
      date.setHours(parseInt(selectedHour), parseInt(selectedMinute), 0, 0);
      onChange(date);
    }
    setIsOpen(false);
  };

  const handleClear = () => {
    onChange(null);
    setSelectedDate(undefined);
    setSelectedHour("12");
    setSelectedMinute("00");
    setIsOpen(false);
  };

  const hours = Array.from({ length: 24 }, (_, i) =>
    i.toString().padStart(2, "0")
  );
  const minutes = Array.from({ length: 12 }, (_, i) =>
    (i * 5).toString().padStart(2, "0")
  );

  // 禁用过去的日期
  const disabledDays = { before: new Date() };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          disabled={disabled}
          className={cn(
            "gap-1 h-8 px-2",
            value && "text-primary"
          )}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="text-xs">
            {value ? format(value, "MM-dd HH:mm") : "定时"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="p-3 space-y-3">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={setSelectedDate}
            disabled={disabledDays}
            locale={zhCN}
            className="rounded-md border"
          />

          {/* 时间选择 */}
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <Select value={selectedHour} onValueChange={setSelectedHour}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hours.map((hour) => (
                  <SelectItem key={hour} value={hour}>
                    {hour}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>:</span>
            <Select value={selectedMinute} onValueChange={setSelectedMinute}>
              <SelectTrigger className="w-[70px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {minutes.map((minute) => (
                  <SelectItem key={minute} value={minute}>
                    {minute}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* 按钮 */}
          <div className="flex justify-between">
            <Button variant="ghost" size="sm" onClick={handleClear}>
              清除
            </Button>
            <Button
              size="sm"
              onClick={handleConfirm}
              disabled={!selectedDate}
            >
              确认
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
