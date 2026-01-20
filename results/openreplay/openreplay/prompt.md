I ran Buoy (a design drift detection tool) on the open source repository **openreplay/openreplay**.

Please analyze the results and help me understand:
1. Are these drift signals accurate or false positives?
2. What patterns did Buoy miss that it should have caught?
3. How can we improve Buoy's detection for this type of codebase?

<repository_context>
URL: https://github.com/openreplay/openreplay
Stars: 11662
Language: TypeScript
Design System Signals: 
Score: 5
</repository_context>

<scan_results>
Components detected: 0
Tokens detected: 0
Sources scanned: 
</scan_results>

<drift_signals>
Total: 60

By type:
  - hardcoded-value: 60

Top signals:

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/withRecaptcha.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary CSS property found. Consider using utility classes.
  Location: frontend/app/withRecaptcha.tsx:16
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/IssuesSummary/IssueSessionsModal.tsx:size
  Type: hardcoded-value
  Severity: info
  Message: 3 arbitrary size values found. Consider using theme values.
  Location: frontend/app/components/IssuesSummary/IssueSessionsModal.tsx:104
  Expected: "Use Tailwind theme tokens"
  Actual: "3 arbitrary size values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/DataManagement/FilterEntriesModal.tsx:size
  Type: hardcoded-value
  Severity: info
  Message: 2 arbitrary size values found. Consider using theme values.
  Location: frontend/app/components/DataManagement/FilterEntriesModal.tsx:50
  Expected: "Use Tailwind theme tokens"
  Actual: "2 arbitrary size values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/Charts/SankeyChart.tsx:size
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary size value found. Consider using theme values.
  Location: frontend/app/components/Charts/SankeyChart.tsx:443
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary size values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/Charts/PieChart.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary CSS property found. Consider using utility classes.
  Location: frontend/app/components/Charts/PieChart.tsx:15
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/Charts/ColumnChart.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary CSS property found. Consider using utility classes.
  Location: frontend/app/components/Charts/ColumnChart.tsx:12
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/Alerts/AlertForm.tsx:size
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary size value found. Consider using theme values.
  Location: frontend/app/components/Alerts/AlertForm.tsx:262
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary size values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/ui/Pagination/Pagination.tsx:size
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary size value found. Consider using theme values.
  Location: frontend/app/components/ui/Pagination/Pagination.tsx:82
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary size values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/ui/Input/Input.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary CSS property found. Consider using utility classes.
  Location: frontend/app/components/ui/Input/Input.tsx:15
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/ui/Form/Form.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 2 arbitrary CSS properties found. Consider using utility classes.
  Location: frontend/app/components/ui/Form/Form.tsx:6
  Expected: "Use Tailwind theme tokens"
  Actual: "2 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/ui/Checkbox/Checkbox.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary CSS property found. Consider using utility classes.
  Location: frontend/app/components/ui/Checkbox/Checkbox.tsx:7
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/ui/Button/Button.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary CSS property found. Consider using utility classes.
  Location: frontend/app/components/ui/Button/Button.tsx:25
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/shared/SessionItem/SessionItem.tsx:size
  Type: hardcoded-value
  Severity: info
  Message: 4 arbitrary size values found. Consider using theme values.
  Location: frontend/app/components/shared/SessionItem/SessionItem.tsx:307
  Expected: "Use Tailwind theme tokens"
  Actual: "4 arbitrary size values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/shared/SelectDateRange/SelectDateRange.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 2 arbitrary CSS properties found. Consider using utility classes.
  Location: frontend/app/components/shared/SelectDateRange/SelectDateRange.tsx:31
  Expected: "Use Tailwind theme tokens"
  Actual: "2 arbitrary css-property values"

  Signal ID: drift:hardcoded-value:tailwind:frontend/app/components/shared/Select/Select.tsx:css-property
  Type: hardcoded-value
  Severity: info
  Message: 1 arbitrary CSS property found. Consider using utility classes.
  Location: frontend/app/components/shared/Select/Select.tsx:18
  Expected: "Use Tailwind theme tokens"
  Actual: "1 arbitrary css-property values"
</drift_signals>

<affected_files>

## frontend/app/withRecaptcha.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/withRecaptcha.tsx:css-property

```
import React, {
  useState,
  useRef,
  ComponentType,
  ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
} from 'react';
import ReCAPTCHA from 'react-google-recaptcha';
import { toast } from 'react-toastify';
import ENV from '../env';

// Define a more specific type for submission data
export interface SubmissionData {
  [key: string]: any;
}

export interface WithCaptchaProps {
  submitWithCaptcha: (data: SubmissionData) => Promise<any>;
  hasCaptchaError: boolean;
  isVerifyingCaptcha: boolean;
  resetCaptcha: () => void;
}

export interface WithCaptchaOptions {
  position?: 'visible' | 'hidden';
  errorMessage?: string;
  theme?: 'light' | 'dark';
  size?: 'normal' | 'compact' | 'invisible';
}

// Safely get environment variables with fallbacks
const getCaptchaConfig = () => {
  const enabled =
    typeof window !== 'undefined' && ENV.CAPTCHA_ENABLED === 'true';

  const siteKey =
    typeof window !== 'undefined' ? ENV.CAPTCHA_SITE_KEY || '' : '';

  return { enabled, siteKey };
};

/**
 * Higher-Order Component that adds reCAPTCHA functionality to a form component
 *
 * @param WrappedComponent The component to wrap with CAPTCHA functionality
 * @param options Configuration options for the CAPTCHA behavior
 * @returns A new component with CAPTCHA capabilities
 */

... [132 lines truncated] ...

            );
            reject(new Error('CAPTCHA verification required'));
            setIsVerifyingCaptcha(false);
          }
        });
      },
      [CAPTCHA_ENABLED, captchaToken, errorMessage, size, isVerifyingCaptcha],
    );

    const hasCaptchaError = !captchaToken && CAPTCHA_ENABLED === true;

    return (
      <>
        {CAPTCHA_ENABLED && (
          <div className={position === 'hidden' ? 'sr-only' : 'mb-4'}>
            <ReCAPTCHA
              ref={recaptchaRef}
              sitekey={CAPTCHA_SITE_KEY}
              onChange={onCaptchaChange}
              onExpired={onCaptchaExpired}
              theme={theme}
              size={size}
            />
            {hasCaptchaError && (
              <div className="text-red-500 text-sm mt-1">{errorMessage}</div>
            )}
          </div>
        )}
        <WrappedComponent
          {...props}
          submitWithCaptcha={submitWithCaptcha}
          hasCaptchaError={hasCaptchaError}
          isVerifyingCaptcha={isVerifyingCaptcha}
          resetCaptcha={resetCaptcha}
        />
      </>
    );
  };

  // Display name for debugging
  const wrappedComponentName =
    WrappedComponent.displayName || WrappedComponent.name || 'Component';

  WithCaptchaComponent.displayName = `WithCaptcha(${wrappedComponentName})`;

  return WithCaptchaComponent;
};

export default withCaptcha;

```

## frontend/app/components/IssuesSummary/IssueSessionsModal.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/IssuesSummary/IssueSessionsModal.tsx:size

```
import React from 'react';
import { Select, Input, Tag } from 'antd';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import SessionItem from 'Shared/SessionItem';
import {
  sortValues,
  SortDropdown,
  sortOptions,
  sortOptionsMap,
} from 'Shared/SessionsTabOverview/components/SessionSort/SessionSort';
import { getSessions } from './api';
import { Loader } from 'UI';
import Session from 'Types/session/session';
import { debounce } from 'App/utils';

interface IssueSession {
  session: Session;
  journey: string;
  journeyLabels: string[];
  issueDescription: string;
  issueLabels: string[];
  issueTimestamp: number | null;
}

function IssueSessions({
  issueName,
  issueLabels,
  journeyLabels,
  projectId,
  hideModal,
}: {
  issueName: string;
  issueLabels: string[];
  journeyLabels: string[];
  projectId: string;
  hideModal: () => void;
}) {
  const limit = 10;
  const page = 1;
  const range = React.useMemo(
    () => [Date.now() - 30 * 24 * 60 * 60 * 1000, Date.now()],
    [],
  );
  const [sortBy, setSort] = React.useState(sortValues.timeDesc);
  const [usedIssueLabels, setUsedIssueLabels] = React.useState<string[]>([]);
  const [usedJourneyLabels, setUsedJourneyLabels] = React.useState<string[]>(
    [],
  );
  const [searchQuery, setSearchQuery] = React.useState('');

... [119 lines truncated] ...

  const onShow = () => {
    setShowDescription(!showDescription);
  };
  if (!issueSession) return null;
  return (
    <div className={'mb-2'}>
      <SessionItem
        key={index}
        noHover
        session={issueSession.session}
        query={
          issueSession.issueTimestamp
            ? `?jumpto=${issueSession.issueTimestamp}`
            : undefined
        }
        onBeforeOpen={hideModal}
      />
      <div className="px-4 py-2 border-b border-b-gray-light flex flex-col gap-2">
        <div className="rounded-lg p-2 bg-gray-lightest flex items-start gap-2">
          <div className="bg-red rounded-lg w-1 h-[21px]" />
          <div>{issueSession.issueDescription}</div>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center flex-wrap gap-2">
            {issueSession.journeyLabels.map((l, i) => (
              <Tag className="!m-0" key={`${l.replace(' ', '.')}_${i}`}>
                {l}
              </Tag>
            ))}
          </div>
          <div className="text-sm color-blue cursor-pointer" onClick={onShow}>
            {showDescription ? 'Show less' : 'Learn more'}
          </div>
        </div>
        {showDescription ? (
          <>
            <div className="text-gray-500 text-sm">
              {issueSession.journey
                ? issueSession.journey
                : 'No description available'}
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}

export default IssueSessions;

```

## frontend/app/components/DataManagement/FilterEntriesModal.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/DataManagement/FilterEntriesModal.tsx:size

```
import React from 'react';
import { Input, Checkbox, Button } from 'antd';
import cn from 'classnames';
import OutsideClickDetectingDiv from 'Shared/OutsideClickDetectingDiv';

function FilterEntriesModal({
  columns,
  onSelect,
  hiddenCols,
  topOffset = 'top-28',
  header,
  subheader,
  searchText,
  confirmText,
  onClose,
  left,
}: {
  columns: { title: string; key: string }[];
  onSelect: (col: string[]) => void;
  hiddenCols: string[];
  topOffset?: string;
  header?: string;
  subheader?: string;
  searchText?: string;
  confirmText?: string;
  onClose?: () => void;
  left?: string;
}) {
  const [query, setQuery] = React.useState('');
  const [selected, setSelected] = React.useState(
    columns.map((col) => col.key).filter((col) => !hiddenCols.includes(col)),
  );

  const onConfirm = () => {
    onSelect(selected);
  };
  const onToggle = (col: string, isSelected: boolean) => {
    const newList = isSelected
      ? [...selected, col]
      : selected.filter((c) => c !== col);
    setSelected(newList);
  };

  const searchRe = new RegExp(query, 'ig');
  const filteredList = columns.filter((col) => searchRe.test(col.title));
  return (
    <OutsideClickDetectingDiv onClickOutside={onClose}>
      <div
        className={cn(
          'flex flex-col gap-2 shadow border rounded-lg p-4 absolute z-50 bg-white min-w-[300px]',
          left ? `left-${left ?? 0}` : 'right-0',
          topOffset,
        )}
      >
        <div className="font-semibold text-lg">{header}</div>
        <div className="text-sm">{subheader}</div>
        <Input.Search
          placeholder={searchText || 'Search entries'}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <div className="max-h-[500px] overflow-y-auto flex flex-col gap-2">
          {filteredList.map((col) => (
            <Checkbox
              onChange={(e) => onToggle(col.key, e.target.checked)}
              checked={selected.includes(col.key)}
            >
              {col.title}
            </Checkbox>
          ))}
        </div>
        <Button onClick={onConfirm} type={'primary'}>
          {confirmText || 'Show Selected'}
        </Button>
      </div>
    </OutsideClickDetectingDiv>
  );
}

export default FilterEntriesModal;

```

## frontend/app/components/Charts/PieChart.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/Charts/PieChart.tsx:css-property

```
import React, { useEffect, useRef } from 'react';
import { PieChart as EchartsPieChart } from 'echarts/charts';
import { echarts, defaultOptions } from './init';
import {
  buildPieData,
  pieTooltipFormatter,
  pickColorByIndex,
} from './pieUtils';

echarts.use([EchartsPieChart]);

interface DataItem {
  time: string;
  timestamp: number;
  [seriesName: string]: number | string;
}

interface PieChartProps {
  data: {
    chart: DataItem[];
    namesMap: string[];
  };
  label?: string;
  inGrid?: boolean;
  onSeriesFocus?: (seriesName: string) => void;
}

function PieChart(props: PieChartProps) {
  const { data, label, onClick = () => {}, inGrid = false } = props;
  const chartRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chartRef.current) return;
    if (!data.chart || data.chart.length === 0) {
      chartRef.current.innerHTML =
        '<div style="text-align:center;padding:20px;">No data available</div>';
      return;
    }

    const chartInstance = echarts.init(chartRef.current);

    const pieData = buildPieData(data.chart, data.namesMap);
    if (!pieData.length) {
      chartRef.current.innerHTML =
        '<div style="text-align:center;padding:20px;">No data available</div>';
      return;
    }

    // const largestSlice = pieData.reduce((acc, curr) =>
    //   curr.value > acc.value ? curr : acc

... [35 lines truncated] ...

            name: d.name,
            value: d.value,
            label: {
              show: false, // d.value / largestVal >= 0.03,
              position: 'outside',
              formatter: (params: any) => params.value,
            },
            labelLine: {
              show: false, // d.value / largestVal >= 0.03,
              length: 10,
              length2: 20,
              lineStyle: { color: '#3EAAAF' },
            },
            itemStyle: {
              color: pickColorByIndex(idx),
            },
          })),
          emphasis: {
            scale: true,
            scaleSize: 4,
          },
        },
      ],
    };

    chartInstance.setOption(option);
    const obs = new ResizeObserver(() => chartInstance.resize());
    obs.observe(chartRef.current);

    chartInstance.on('click', (params) => {
      const focusedSeriesName = params.name;
      props.onSeriesFocus?.(focusedSeriesName);
    });

    return () => {
      chartInstance.dispose();
      obs.disconnect();
    };
  }, [data, label, onClick, inGrid]);

  return (
    <div
      style={{ width: '100%', height: 240, position: 'relative' }}
      ref={chartRef}
    />
  );
}

export default PieChart;

```

## frontend/app/components/Charts/ColumnChart.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/Charts/ColumnChart.tsx:css-property

```
import React from 'react';
import { BarChart } from 'echarts/charts';
import { defaultOptions, echarts } from './init';
import { customTooltipFormatter } from './utils';
import { buildColumnChart } from './barUtils';

echarts.use([BarChart]);

interface DataItem {
  time: string;
  timestamp: number;
  [seriesName: string]: number | string;
}

export interface DataProps {
  data: {
    chart: DataItem[];
    namesMap: string[];
  };
  compData?: {
    chart: DataItem[];
    namesMap: string[];
  };
}

interface ColumnChartProps extends DataProps {
  label?: string;
  onSeriesFocus?: (name: string) => void;
}

function ColumnChart(props: ColumnChartProps) {
  const { data, compData, label } = props;
  const chartRef = React.useRef<HTMLDivElement>(null);
  const chartUuid = React.useRef<string>(
    Math.random().toString(36).substring(7),
  );

  React.useEffect(() => {
    if (!chartRef.current) return;
    const chart = echarts.init(chartRef.current);
    (window as any).__seriesValueMap = (window as any).__seriesValueMap ?? {};
    (window as any).__seriesValueMap[chartUuid.current] = {};
    (window as any).__seriesColorMap = (window as any).__seriesColorMap ?? {};
    (window as any).__seriesColorMap[chartUuid.current] = {};
    (window as any).__yAxisData = (window as any).__yAxisData ?? {};

    const { yAxisData, series } = buildColumnChart(
      chartUuid.current,
      data,
      compData,

... [12 lines truncated] ...

          .filter((s: any) => !s._hideInLegend)
          .map((s: any) => s.name),
      },
      toolbox: {
        feature: {
          saveAsImage: { show: false },
        },
      },
      grid: {
        ...defaultOptions.grid,
        left: 40,
        right: 30,
        top: 40,
        bottom: 30,
      },
      xAxis: {
        type: 'value',
        name: label ?? 'Total',
        nameLocation: 'center',
        nameGap: 35,
      },
      yAxis: {
        ...defaultOptions.yAxis,
        type: 'category',
        data: yAxisData,
      },
      series,
    });

    const obs = new ResizeObserver(() => chart.resize());
    obs.observe(chartRef.current);
    chart.on('click', (event) => {
      const focusedSeriesName = event.name;
      props.onSeriesFocus?.(focusedSeriesName);
    });

    return () => {
      chart.dispose();
      obs.disconnect();
      delete (window as any).__seriesValueMap[chartUuid.current];
      delete (window as any).__seriesColorMap[chartUuid.current];
      delete (window as any).__yAxisData[chartUuid.current];
    };
  }, [data, compData, label]);

  return <div ref={chartRef} style={{ width: '100%', height: 240 }} />;
}

export default ColumnChart;

```

## frontend/app/components/ui/Pagination/Pagination.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/ui/Pagination/Pagination.tsx:size

```
import React from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from 'antd';
import { debounce } from 'App/utils';

// unchanged: props interface
type Props = {
  page: number;
  total: number;
  onPageChange: (page: number) => void;
  limit?: number;
  debounceRequest?: number;
};

export default function Pagination({
  page,
  total,
  onPageChange,
  limit = 5,
  debounceRequest = 0,
}: Props) {
  const [currentPage, setCurrentPage] = React.useState(page);
  const [inputValue, setInputValue] = React.useState('');

  React.useEffect(() => {
    setCurrentPage(page);
  }, [page]);

  const totalPages = React.useMemo(
    () => Math.max(1, Math.ceil(total / limit)),
    [total, limit],
  );

  const fmt = React.useMemo(() => new Intl.NumberFormat('en-US'), []);

  React.useEffect(() => {
    setInputValue(fmt.format(page));
  }, [page, fmt]);

  const debounceChange = React.useCallback(
    debounce(onPageChange, debounceRequest),
    [onPageChange, debounceRequest],
  );

  const changePage = (next: number) => {
    if (next < 1 || next > totalPages) return;
    setCurrentPage(next);
    setInputValue(fmt.format(next));
    debounceChange(next);
  };

  const commitInput = React.useCallback(() => {
    const num = parseInt(inputValue.replace(/[^0-9]/g, ''), 10);
    if (!Number.isNaN(num)) {
      changePage(num);
    } else {
      setInputValue(fmt.format(currentPage));
    }
  }, [inputValue, changePage, currentPage, fmt]);

  return (
    <div className="flex items-center gap-2 select-none">
      <button
        aria-label="Previous page"
        disabled={currentPage === 1}
        onClick={() => changePage(currentPage - 1)}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-lightest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronLeft size={16} />
      </button>

      <div className="flex items-center gap-2">
        <Input
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onPressEnter={commitInput}
          onBlur={commitInput}
          className="w-12 text-center px-2 py-0 rounded"
          size="small"
        />
        <span>/</span>
        <span className="min-w-[50px] text-center">
          {fmt.format(totalPages)}
        </span>
      </div>

      <button
        aria-label="Next page"
        disabled={currentPage === totalPages}
        onClick={() => changePage(currentPage + 1)}
        className="w-8 h-8 flex items-center justify-center rounded hover:bg-gray-lightest disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <ChevronRight size={16} />
      </button>
    </div>
  );
}

```

## frontend/app/components/ui/Input/Input.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/ui/Input/Input.tsx:css-property

```
import cn from 'classnames';
import React from 'react';
import { Input as AntInput } from 'antd';
import { Icon } from 'UI';

interface Props {
  wrapperClassName?: string;
  className?: string;
  icon?: string;
  leadingButton?: React.ReactNode;
  type?: string;
  rows?: number;
  height?: number;
  width?: number;
  [x: string]: any;
}
const Input = React.forwardRef((props: Props, ref: any) => {
  const {
    height = 36,
    width = 0,
    className = '',
    leadingButton = '',
    wrapperClassName = '',
    icon = '',
    type = 'text',
    rows = 4,
    ...rest
  } = props;
  return (
    <div className={cn({ relative: icon || leadingButton }, wrapperClassName)}>
      {icon && (
        <Icon
          name={icon}
          className="absolute top-0 bottom-0 my-auto ml-4 z-10"
          size="14"
        />
      )}
      {type === 'textarea' ? (
        <AntInput.TextArea
          ref={ref}
          rows={rows}
          style={{ resize: 'none' }}
          maxLength={500}
          className={cn(
            'p-2 border border-gray-light bg-white w-full rounded-lg',
            className,
            { 'pl-10': icon },
          )}
          {...rest}
        />
      ) : (
        <AntInput
          ref={ref}
          type={type}
          style={{ height: `${height}px`, width: width ? `${width}px` : '' }}
          className={cn(
            'p-2 border border-gray-light bg-white w-full rounded-lg',
            className,
            { 'pl-10': icon },
          )}
          {...rest}
        />
      )}

      {leadingButton && (
        <div className="absolute top-0 bottom-0 right-0">{leadingButton}</div>
      )}
    </div>
  );
});

export default Input;

```

## frontend/app/components/ui/Form/Form.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/ui/Form/Form.tsx:css-property

```
import React from 'react';

interface Props {
  children: React.ReactNode;
  onSubmit?: any;
  [x: string]: any;
}

interface FormFieldProps {
  children: React.ReactNode;
  [x: string]: any;
}
function FormField(props: FormFieldProps) {
  const { children, ...rest } = props;
  return (
    <div {...rest} className="flex flex-col mb-4 form-field">
      {children}
    </div>
  );
}

function Form(props: Props) {
  const { children, ...rest } = props;
  return (
    <form
      {...rest}
      onSubmit={(e) => {
        e.preventDefault();
        if (props.onSubmit) {
          props.onSubmit(e);
        }
      }}
    >
      {children}
    </form>
  );
}

Form.Field = FormField;

export default Form;

```

## frontend/app/components/ui/Checkbox/Checkbox.tsx
Related signals: drift:hardcoded-value:tailwind:frontend/app/components/ui/Checkbox/Checkbox.tsx:css-property

```
import React from 'react';
import { Checkbox as AntCheckbox } from 'antd';

interface Props {
  className?: string;
  label?: string;
  [x: string]: any;
}
export default function (props: Props) {
  const { className = '', label = '', ...rest } = props;
  return <AntCheckbox {...rest}>{label}</AntCheckbox>;
}

```
</affected_files>

<git_history>

## frontend/app/withRecaptcha.tsx
  - 8cac0d3 | 2026-01-20 | Mehdi Osman
    Increment chalice chart version to v1.24.7 (#4215)

## frontend/app/components/IssuesSummary/IssueSessionsModal.tsx
  - 8cac0d3 | 2026-01-20 | Mehdi Osman
    Increment chalice chart version to v1.24.7 (#4215)

## frontend/app/components/DataManagement/FilterEntriesModal.tsx
  - 8cac0d3 | 2026-01-20 | Mehdi Osman
    Increment chalice chart version to v1.24.7 (#4215)

## frontend/app/components/Charts/PieChart.tsx
  - 8cac0d3 | 2026-01-20 | Mehdi Osman
    Increment chalice chart version to v1.24.7 (#4215)

## frontend/app/components/Charts/ColumnChart.tsx
  - 8cac0d3 | 2026-01-20 | Mehdi Osman
    Increment chalice chart version to v1.24.7 (#4215)
</git_history>

<questions>

## Accuracy Assessment
For each drift signal above, classify it as:
- **True Positive**: Correctly identified actual drift
- **False Positive**: Flagged something that isn't actually a problem
- **Needs Context**: Cannot determine without more information

## Coverage Gaps
Looking at the codebase, what drift patterns exist that Buoy didn't detect?
Consider:
- Hardcoded values that should use design tokens
- Inconsistent naming patterns
- Deprecated patterns still in use
- Components that diverge from design system

## Improvement Suggestions
What specific improvements would make Buoy more effective for this type of codebase?
Consider:
- New drift types to detect
- Better heuristics for existing detections
- Framework-specific patterns to recognize
- False positive reduction strategies
</questions>