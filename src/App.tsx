import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  Upload, FileSpreadsheet, X, Download, AlertCircle, Package, Clock,
  Activity, ChevronLeft, Search, ChevronDown, ChevronUp, BarChart3,
  Filter, FileDown, PieChart, TrendingUp, Moon, Sun, Languages, Settings,
  GitCompareArrows
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RTooltip,
  ResponsiveContainer, PieChart as RPieChart, Pie, Cell, Legend,
  LineChart, Line, AreaChart, Area
} from 'recharts';
import * as XLSX from 'xlsx';
import Papa from 'papaparse';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DataRow {
  [key: string]: any;
}

interface FilteredDataSet {
  name: string;
  data: DataRow[];
  description: string;
}

interface AnalysisResult {
  totalIssues: number;
  totalQuantity: number;
  cret: { count: number; quantity: number; data: DataRow[] };
  fcReceive: { count: number; quantity: number; ageOverThreshold: number; data: DataRow[] };
  fcActionable: { count: number; quantity: number; ageOverThreshold: number; data: DataRow[] };
  mfi: { totalCount: number; ageOverThreshold: number; workInProgress: number; data: DataRow[] };
  pendingRBS_PSAS: { count: number; quantity: number; data: DataRow[] };
  binCheck: { andonCord: number; binCheckRequest: number; total: number; andonCordData: DataRow[]; binCheckRequestData: DataRow[]; allData: DataRow[] };
  others: { count: number; quantity: number; data: DataRow[] };
}

interface DashboardSettings {
  fcReceiveAgeThreshold: number;
  fcActionableAgeThreshold: number;
  mfiAgeThreshold: number;
}

interface ShiftDiffRow {
  key: string;
  item: string;
  title: string;
  issueType: string;
  startIssueType: string;
  endIssueType: string;
  changeType: 'added' | 'removed' | 'qty_increased' | 'qty_decreased' | 'status_changed' | 'type_changed';
  startQty: number;
  endQty: number;
  qtyDelta: number;
  startStatus: string;
  endStatus: string;
}

const RBS_PSAS_ITEMS = [
  'Add/Remove Expiration/Food Flag', 'Barcode links multiple ASIN',
  'Barcode links wrong item', 'Barcode not linked', 'Binding Update',
  'Binding Update / Item Not in Catalog', 'Detail Page Issue',
  'Expiration Date Issue', 'Image Update', 'Item Not In Catalog',
  'No PO Found', 'No PO Found - No Problem Slip', 'Not On PO',
  'Title Update', 'Vendor Compliance'
];

const CHART_COLORS = ['#6366f1', '#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#06b6d4', '#f43f5e', '#64748b'];

export default function App() {
  const [data, setData] = useState<DataRow[]>([]);
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [fileName, setFileName] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [language, setLanguage] = useState<'en' | 'ar'>(() => (localStorage.getItem('iss-language') === 'en' ? 'en' : 'ar'));
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('iss-dark-mode') === '1');
  const [settings, setSettings] = useState<DashboardSettings>({ fcReceiveAgeThreshold: 10, fcActionableAgeThreshold: 10, mfiAgeThreshold: 5 });
  const [startShiftData, setStartShiftData] = useState<DataRow[]>([]);
  const [endShiftData, setEndShiftData] = useState<DataRow[]>([]);
  const [shiftDiffRows, setShiftDiffRows] = useState<ShiftDiffRow[]>([]);
  const [startShiftFileName, setStartShiftFileName] = useState('');
  const [endShiftFileName, setEndShiftFileName] = useState('');

  // Global search & filter
  const [globalSearch, setGlobalSearch] = useState('');
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [showFilters, setShowFilters] = useState(false);
  const [ageFilterMin, setAgeFilterMin] = useState('');
  const [ageFilterMax, setAgeFilterMax] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [pendingReasonFilter, setPendingReasonFilter] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');

  // Dialog state
  const [selectedDataset, setSelectedDataset] = useState<FilteredDataSet | null>(null);
  const [dialogSearchTerm, setDialogSearchTerm] = useState('');
  const [dialogSortColumn, setDialogSortColumn] = useState('');
  const [dialogSortDirection, setDialogSortDirection] = useState<'asc' | 'desc'>('asc');

  const i18n = {
    en: {
      dashboard: 'Dashboard', charts: 'Charts', explorer: 'Data Explorer', settings: 'Settings',
      reconciliation: 'Shift Reconciliation',
      filters: 'Filters', clear: 'Clear', clearAllFilters: 'Clear All Filters',
      rows: 'rows', newFile: 'New File',
      ageThreshold: 'Age threshold', language: 'Language', darkMode: 'Dark mode',
      category: 'Category', pendingReason: 'Pending Reason', issueType: 'Issue Type', typeBreakdown: 'Type Breakdown',
      startShift: 'Start Shift', endShift: 'End Shift',
      compareNow: 'Compare',
      appTitle: 'ISS Dashboard',
      uploadStart: 'Upload your CSV or Excel file to get instant insights',
      uploadDrop: 'Drop your file here',
      uploadDrag: 'Drag & drop your file',
      uploadBrowse: 'or click to browse from your computer',
      analyzing: 'Analyzing your data...',
      uploadStartFile: 'Upload Start File',
      uploadEndFile: 'Upload End File',
      compareSummary: 'Comparison by Type',
      transitionSummary: 'Type Transitions',
      added: 'Added',
      removed: 'Removed',
      qtyIncreased: 'Qty Increased',
      qtyDecreased: 'Qty Decreased',
      statusChanged: 'Status Changed',
      typeChanged: 'Type Changed',
      fromType: 'From Type',
      toType: 'To Type',
      noTransitions: 'No type transitions found',
      executionBy: 'Implemented by Mahmoud Kandeel',
      supportContact: 'For any inquiry or issue, contact: mahmabdr@amazon.com',
      overDays: (days: number) => `>${days} days`
    },
    ar: {
      dashboard: 'الرئيسية', charts: 'الرسوم', explorer: 'استكشاف البيانات', settings: 'الإعدادات',
      reconciliation: 'مقارنة بداية/نهاية الشيفت',
      filters: 'الفلاتر', clear: 'مسح', clearAllFilters: 'مسح كل الفلاتر',
      rows: 'صف', newFile: 'ملف جديد',
      ageThreshold: 'حد الأيام', language: 'اللغة', darkMode: 'الوضع الليلي',
      category: 'الفئة', pendingReason: 'سبب التعليق', issueType: 'نوع الحالة', typeBreakdown: 'توزيع الأنواع',
      startShift: 'بداية الشيفت', endShift: 'نهاية الشيفت',
      compareNow: 'قارن الآن',
      appTitle: 'ISS Dashboard',
      uploadStart: 'ارفع ملف CSV أو Excel لعرض التحليل فورًا',
      uploadDrop: 'اسحب الملف هنا',
      uploadDrag: 'اسحب الملف وأفلته',
      uploadBrowse: 'أو اضغط للاختيار من جهازك',
      analyzing: 'جارٍ تحليل البيانات...',
      uploadStartFile: 'ارفع ملف البداية',
      uploadEndFile: 'ارفع ملف النهاية',
      compareSummary: 'ملخص المقارنة حسب النوع',
      transitionSummary: 'التحويلات بين الأنواع',
      added: 'جديد',
      removed: 'مزال',
      qtyIncreased: 'زيادة كمية',
      qtyDecreased: 'نقص كمية',
      statusChanged: 'تغيير حالة',
      typeChanged: 'تغيير نوع',
      fromType: 'من نوع',
      toType: 'إلى نوع',
      noTransitions: 'لا يوجد تحويلات بين الأنواع',
      executionBy: 'تنفيذ Mahmoud Kandeel',
      supportContact: 'لأي استفسار أو مشكلة تواصل مع: mahmabdr@amazon.com',
      overDays: (days: number) => `أكثر من ${days} أيام`
    }
  } as const;

  const t = i18n[language];

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  useEffect(() => {
    localStorage.setItem('iss-language', language);
  }, [language]);

  useEffect(() => {
    localStorage.setItem('iss-dark-mode', darkMode ? '1' : '0');
  }, [darkMode]);



  const getChangeTypeLabel = useCallback((changeType: ShiftDiffRow['changeType']) => {
    switch (changeType) {
      case 'added': return t.added;
      case 'removed': return t.removed;
      case 'qty_increased': return t.qtyIncreased;
      case 'qty_decreased': return t.qtyDecreased;
      case 'status_changed': return t.statusChanged;
      case 'type_changed': return t.typeChanged;
      default: return changeType;
    }
  }, [t]);

  const getRowCategory = useCallback((row: DataRow) => {
    const title = String(row['Title'] || '').toLowerCase();
    const item = String(row['Item'] || '').toLowerCase();
    const location = String(row['PhysicalLocation'] || '').toLowerCase();
    const pendingReason = String(row['PendingReason'] || '').toLowerCase();
    if (title.includes('cret') || item.includes('c-return') || item.includes('customer return') || location.includes('tscret')) return 'CRET';
    if (pendingReason.includes('fc receive')) return 'FC Receive';
    if (pendingReason.includes('requester information') && pendingReason.includes('fc actionable')) return 'FC Actionable';
    if (item.includes('fba missing from inbound')) return 'MFI';
    if (title.includes('andon cord') || title.includes('bin check request on')) return 'Bin Check';
    if (RBS_PSAS_ITEMS.some(i => item.includes(i.toLowerCase()))) return 'RBS / PSAS';
    return 'Others';
  }, []);

  const calculateMetrics = useCallback((parsedData: DataRow[]): AnalysisResult => {
    if (parsedData.length === 0) {
      return {
        totalIssues: 0, totalQuantity: 0,
        cret: { count: 0, quantity: 0, data: [] },
        fcReceive: { count: 0, quantity: 0, ageOverThreshold: 0, data: [] },
        fcActionable: { count: 0, quantity: 0, ageOverThreshold: 0, data: [] },
        mfi: { totalCount: 0, ageOverThreshold: 0, workInProgress: 0, data: [] },
        pendingRBS_PSAS: { count: 0, quantity: 0, data: [] },
        binCheck: { andonCord: 0, binCheckRequest: 0, total: 0, andonCordData: [], binCheckRequestData: [], allData: [] },
        others: { count: 0, quantity: 0, data: [] }
      };
    }

    const cretMask = (row: DataRow) => {
      const title = String(row['Title'] || '').toLowerCase();
      const item = String(row['Item'] || '').toLowerCase();
      const location = String(row['PhysicalLocation'] || '').toLowerCase();
      return title.includes('cret') || item.includes('c-return') || item.includes('customer return') || location.includes('tscret');
    };

    const cretData = parsedData.filter(cretMask);
    const cretCount = cretData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const cretQuantity = cretData.reduce((s, r) => s + (Number(r['Quantity']) || 0), 0);

    const nonCretData = parsedData.filter(r => !cretMask(r));
    const totalIssues = nonCretData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const totalQuantity = nonCretData.reduce((s, r) => s + (Number(r['Quantity']) || 0), 0);

    const fcReceiveData = nonCretData.filter(r => String(r['PendingReason'] || '').toLowerCase().includes('fc receive'));
    const fcReceiveCount = fcReceiveData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const fcReceiveQuantity = fcReceiveData.reduce((s, r) => s + (Number(r['Quantity']) || 0), 0);
    const fcReceiveAgeOverThreshold = fcReceiveData.filter(r => Number(r['Age']) > settings.fcReceiveAgeThreshold).length;

    const fcActionableData = nonCretData.filter(r => {
      const pr = String(r['PendingReason'] || '').toLowerCase();
      return pr.includes('requester information') && pr.includes('fc actionable');
    });
    const fcActionableCount = fcActionableData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const fcActionableQuantity = fcActionableData.reduce((s, r) => s + (Number(r['Quantity']) || 0), 0);
    const fcActionableAgeOverThreshold = fcActionableData.filter(r => Number(r['Age']) > settings.fcActionableAgeThreshold).length;

    const mfiData = nonCretData.filter(r => String(r['Item'] || '').toLowerCase().includes('fba missing from inbound'));
    const mfiTotalCount = mfiData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const mfiAgeOverThreshold = mfiData.filter(r => Number(r['Age']) > settings.mfiAgeThreshold).length;
    const mfiWorkInProgress = mfiData.filter(r => String(r['Status'] || '').toLowerCase() === 'work in progress').length;

    const itemRbsMask = (r: DataRow) => {
      const item = String(r['Item'] || '').toLowerCase();
      return RBS_PSAS_ITEMS.some(i => item.includes(i.toLowerCase()));
    };
    const excludeFcMask = (r: DataRow) => {
      const pr = String(r['PendingReason'] || '').toLowerCase();
      return !(pr.includes('fc receive') || (pr.includes('requester information') && pr.includes('fc actionable')));
    };
    const pendingRBSData = nonCretData.filter(r => itemRbsMask(r) && excludeFcMask(r));
    const pendingRBSCount = pendingRBSData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const pendingRBSQuantity = pendingRBSData.reduce((s, r) => s + (Number(r['Quantity']) || 0), 0);

    const andonCordData = nonCretData.filter(r => String(r['Title'] || '').toLowerCase().includes('andon cord'));
    const binCheckRequestData = nonCretData.filter(r => String(r['Title'] || '').toLowerCase().includes('bin check request on'));
    const andonCordCount = andonCordData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const binCheckRequestCount = binCheckRequestData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;

    const fcReceiveMask = (r: DataRow) => String(r['PendingReason'] || '').toLowerCase().includes('fc receive');
    const fcActionableMask = (r: DataRow) => { const pr = String(r['PendingReason'] || '').toLowerCase(); return pr.includes('requester information') && pr.includes('fc actionable'); };
    const mfiMask = (r: DataRow) => String(r['Item'] || '').toLowerCase().includes('fba missing from inbound');
    const andonMask = (r: DataRow) => String(r['Title'] || '').toLowerCase().includes('andon cord');
    const binCheckMask = (r: DataRow) => String(r['Title'] || '').toLowerCase().includes('bin check request on');
    const rbsMask = (r: DataRow) => itemRbsMask(r) && excludeFcMask(r);

    const othersData = nonCretData.filter(r =>
      !fcReceiveMask(r) && !fcActionableMask(r) && !mfiMask(r) && !andonMask(r) && !binCheckMask(r) && !rbsMask(r)
    );
    const othersCount = othersData.filter(r => r['IssueUrl'] && String(r['IssueUrl']).trim() !== '').length;
    const othersQuantity = othersData.reduce((s, r) => s + (Number(r['Quantity']) || 0), 0);

    return {
      totalIssues, totalQuantity,
      cret: { count: cretCount, quantity: cretQuantity, data: cretData },
      fcReceive: { count: fcReceiveCount, quantity: fcReceiveQuantity, ageOverThreshold: fcReceiveAgeOverThreshold, data: fcReceiveData },
      fcActionable: { count: fcActionableCount, quantity: fcActionableQuantity, ageOverThreshold: fcActionableAgeOverThreshold, data: fcActionableData },
      mfi: { totalCount: mfiTotalCount, ageOverThreshold: mfiAgeOverThreshold, workInProgress: mfiWorkInProgress, data: mfiData },
      pendingRBS_PSAS: { count: pendingRBSCount, quantity: pendingRBSQuantity, data: pendingRBSData },
      binCheck: { andonCord: andonCordCount, binCheckRequest: binCheckRequestCount, total: andonCordCount + binCheckRequestCount, andonCordData, binCheckRequestData, allData: [...andonCordData, ...binCheckRequestData] },
      others: { count: othersCount, quantity: othersQuantity, data: othersData }
    };
  }, [settings]);

  const parseFile = useCallback((file: File) => {
    setIsLoading(true);
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result;
        let parsedData: DataRow[] = [];
        if (file.name.endsWith('.csv')) {
          const result = Papa.parse(content as string, { header: true, skipEmptyLines: true, dynamicTyping: true });
          parsedData = result.data as DataRow[];
        } else if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
          const workbook = XLSX.read(content, { type: 'binary' });
          const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
          parsedData = XLSX.utils.sheet_to_json(firstSheet) as DataRow[];
        }
        setData(parsedData);
        setAnalysis(calculateMetrics(parsedData));
        setIsLoading(false);
        setActiveTab('dashboard');
      } catch {
        alert(language === 'ar' ? 'حصل خطأ في قراءة الملف. تأكد من تنسيق الملف.' : 'Error parsing file. Please check the file format.');
        setIsLoading(false);
      }
    };
    if (file.name.endsWith('.csv')) reader.readAsText(file);
    else reader.readAsBinaryString(file);
  }, [calculateMetrics, language]);

  const parseAnyFile = useCallback(async (file: File): Promise<DataRow[]> => {
    const content = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(String(e.target?.result ?? ''));
      reader.onerror = () => reject(new Error('file read error'));
      if (file.name.endsWith('.csv')) reader.readAsText(file);
      else reader.readAsBinaryString(file);
    });

    if (file.name.endsWith('.csv')) {
      const result = Papa.parse(content, { header: true, skipEmptyLines: true, dynamicTyping: true });
      return result.data as DataRow[];
    }
    const workbook = XLSX.read(content, { type: 'binary' });
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
    return XLSX.utils.sheet_to_json(firstSheet) as DataRow[];
  }, []);

  const buildRowKey = useCallback((row: DataRow) => {
    const issueUrl = String(row['IssueUrl'] || '').trim();
    if (issueUrl) return issueUrl;
    const item = String(row['Item'] || '').trim();
    const title = String(row['Title'] || '').trim();
    const pr = String(row['PendingReason'] || '').trim();
    return `${item}__${title}__${pr}`;
  }, []);

  const compareShiftData = useCallback((startRows: DataRow[], endRows: DataRow[]) => {
    const startMap = new Map<string, DataRow>();
    const endMap = new Map<string, DataRow>();
    startRows.forEach(r => startMap.set(buildRowKey(r), r));
    endRows.forEach(r => endMap.set(buildRowKey(r), r));

    const allKeys = new Set([...startMap.keys(), ...endMap.keys()]);
    const diffs: ShiftDiffRow[] = [];

    allKeys.forEach(key => {
      const start = startMap.get(key);
      const end = endMap.get(key);

      if (!start && end) {
        const endType = getRowCategory(end);
        diffs.push({
          key,
          item: String(end['Item'] || ''),
          title: String(end['Title'] || ''),
          issueType: endType,
          startIssueType: '-',
          endIssueType: endType,
          changeType: 'added',
          startQty: 0,
          endQty: Number(end['Quantity']) || 0,
          qtyDelta: Number(end['Quantity']) || 0,
          startStatus: '-',
          endStatus: String(end['Status'] || ''),
        });
        return;
      }

      if (start && !end) {
        const startType = getRowCategory(start);
        diffs.push({
          key,
          item: String(start['Item'] || ''),
          title: String(start['Title'] || ''),
          issueType: startType,
          startIssueType: startType,
          endIssueType: '-',
          changeType: 'removed',
          startQty: Number(start['Quantity']) || 0,
          endQty: 0,
          qtyDelta: -(Number(start['Quantity']) || 0),
          startStatus: String(start['Status'] || ''),
          endStatus: '-',
        });
        return;
      }

      if (!start || !end) return;

      const startQty = Number(start['Quantity']) || 0;
      const endQty = Number(end['Quantity']) || 0;
      const startStatus = String(start['Status'] || '');
      const endStatus = String(end['Status'] || '');
      const startType = getRowCategory(start);
      const endType = getRowCategory(end);

      if (endQty > startQty) {
        diffs.push({
          key,
          item: String(end['Item'] || ''),
          title: String(end['Title'] || ''),
          issueType: endType,
          startIssueType: startType,
          endIssueType: endType,
          changeType: 'qty_increased',
          startQty,
          endQty,
          qtyDelta: endQty - startQty,
          startStatus,
          endStatus,
        });
      } else if (endQty < startQty) {
        diffs.push({
          key,
          item: String(end['Item'] || ''),
          title: String(end['Title'] || ''),
          issueType: endType,
          startIssueType: startType,
          endIssueType: endType,
          changeType: 'qty_decreased',
          startQty,
          endQty,
          qtyDelta: endQty - startQty,
          startStatus,
          endStatus,
        });
      }

      if (startStatus.toLowerCase() !== endStatus.toLowerCase()) {
        diffs.push({
          key: `${key}__status`,
          item: String(end['Item'] || ''),
          title: String(end['Title'] || ''),
          issueType: endType,
          startIssueType: startType,
          endIssueType: endType,
          changeType: 'status_changed',
          startQty,
          endQty,
          qtyDelta: endQty - startQty,
          startStatus,
          endStatus,
        });
      }

      if (startType !== endType) {
        diffs.push({
          key: `${key}__type`,
          item: String(end['Item'] || ''),
          title: String(end['Title'] || ''),
          issueType: endType,
          startIssueType: startType,
          endIssueType: endType,
          changeType: 'type_changed',
          startQty,
          endQty,
          qtyDelta: endQty - startQty,
          startStatus,
          endStatus,
        });
      }
    });

    setShiftDiffRows(diffs);
  }, [buildRowKey, getRowCategory]);

  const handleShiftFileInput = useCallback(async (file: File, which: 'start' | 'end') => {
    if (!(file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls'))) {
      alert(language === 'ar' ? 'من فضلك ارفع ملف CSV أو Excel' : 'Please upload a CSV or Excel file');
      return;
    }
    const parsed = await parseAnyFile(file);
    if (which === 'start') {
      setStartShiftData(parsed);
      setStartShiftFileName(file.name);
    } else {
      setEndShiftData(parsed);
      setEndShiftFileName(file.name);
    }
  }, [parseAnyFile, language]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      const file = files[0];
      if (file.name.endsWith('.csv') || file.name.endsWith('.xlsx') || file.name.endsWith('.xls')) {
        parseFile(file);
      } else {
        alert(language === 'ar' ? 'من فضلك ارفع ملف CSV أو Excel' : 'Please upload a CSV or Excel file');
      }
    }
  }, [parseFile, language]);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) parseFile(files[0]);
  }, [parseFile, language]);

  const clearData = () => {
    setData([]);
    setAnalysis(null);
    setFileName('');
    setGlobalSearch('');
    setColumnFilters({});
    setPendingReasonFilter('');
    setCategoryFilter('');
    setActiveTab('dashboard');
  };

  // Filtered data for the data explorer tab
  const filteredData = useMemo(() => {
    let result = [...data];
    if (globalSearch) {
      const term = globalSearch.toLowerCase();
      result = result.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(term)));
    }
    Object.entries(columnFilters).forEach(([col, val]) => {
      if (val) {
        const term = val.toLowerCase();
        result = result.filter(row => String(row[col] || '').toLowerCase().includes(term));
      }
    });
    if (ageFilterMin) result = result.filter(r => Number(r['Age']) >= Number(ageFilterMin));
    if (ageFilterMax) result = result.filter(r => Number(r['Age']) <= Number(ageFilterMax));
    if (statusFilter) result = result.filter(r => String(r['Status'] || '').toLowerCase().includes(statusFilter.toLowerCase()));
    if (pendingReasonFilter) result = result.filter(r => String(r['PendingReason'] || '').toLowerCase().includes(pendingReasonFilter.toLowerCase()));
    if (categoryFilter) result = result.filter(r => getRowCategory(r) === categoryFilter);
    return result;
  }, [data, globalSearch, columnFilters, ageFilterMin, ageFilterMax, statusFilter, pendingReasonFilter, categoryFilter, getRowCategory]);

  const filteredDataWithType = useMemo(() => (
    filteredData.map(row => ({ ...row, IssueType: getRowCategory(row) }))
  ), [filteredData, getRowCategory]);

  const typeBreakdown = useMemo(() => {
    const map: Record<string, number> = {};
    filteredDataWithType.forEach(row => {
      const key = String(row.IssueType || 'Others');
      map[key] = (map[key] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [filteredDataWithType]);

  const shiftTypeSummary = useMemo(() => {
    const map: Record<string, { added: number; removed: number; qtyIncreased: number; qtyDecreased: number; statusChanged: number; typeChanged: number }> = {};
    const init = () => ({ added: 0, removed: 0, qtyIncreased: 0, qtyDecreased: 0, statusChanged: 0, typeChanged: 0 });

    shiftDiffRows.forEach((row) => {
      const key = row.endIssueType !== '-' ? row.endIssueType : row.startIssueType;
      if (!map[key]) map[key] = init();
      if (row.changeType === 'added') map[key].added += 1;
      if (row.changeType === 'removed') map[key].removed += 1;
      if (row.changeType === 'qty_increased') map[key].qtyIncreased += 1;
      if (row.changeType === 'qty_decreased') map[key].qtyDecreased += 1;
      if (row.changeType === 'status_changed') map[key].statusChanged += 1;
      if (row.changeType === 'type_changed') map[key].typeChanged += 1;
    });

    return Object.entries(map).sort((a, b) => {
      const aTotal = Object.values(a[1]).reduce((s, v) => s + v, 0);
      const bTotal = Object.values(b[1]).reduce((s, v) => s + v, 0);
      return bTotal - aTotal;
    });
  }, [shiftDiffRows]);

  const typeTransitions = useMemo(() => {
    const map: Record<string, number> = {};
    shiftDiffRows
      .filter((r) => r.changeType === 'type_changed')
      .forEach((r) => {
        const key = `${r.startIssueType} -> ${r.endIssueType}`;
        map[key] = (map[key] || 0) + 1;
      });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [shiftDiffRows]);

  // Chart data
  const chartData = useMemo(() => {
    if (!analysis) return { category: [], pie: [], ageDist: [], statusDist: [] };
    const category = [
      { name: 'CRET', issues: analysis.cret.count, quantity: analysis.cret.quantity },
      { name: 'FC Receive', issues: analysis.fcReceive.count, quantity: analysis.fcReceive.quantity },
      { name: 'FC Actionable', issues: analysis.fcActionable.count, quantity: analysis.fcActionable.quantity },
      { name: 'MFI', issues: analysis.mfi.totalCount, quantity: 0 },
      { name: 'RBS/PSAS', issues: analysis.pendingRBS_PSAS.count, quantity: analysis.pendingRBS_PSAS.quantity },
      { name: 'Bin Check', issues: analysis.binCheck.total, quantity: 0 },
      { name: 'Others', issues: analysis.others.count, quantity: analysis.others.quantity },
    ];
    const pie = category.filter(c => c.issues > 0).map(c => ({ name: c.name, value: c.issues }));

    // Age distribution
    const ageBuckets: Record<string, number> = { '0-2': 0, '3-5': 0, '6-10': 0, '11-20': 0, '21-30': 0, '30+': 0 };
    data.forEach(r => {
      const age = Number(r['Age']);
      if (isNaN(age)) return;
      if (age <= 2) ageBuckets['0-2']++;
      else if (age <= 5) ageBuckets['3-5']++;
      else if (age <= 10) ageBuckets['6-10']++;
      else if (age <= 20) ageBuckets['11-20']++;
      else if (age <= 30) ageBuckets['21-30']++;
      else ageBuckets['30+']++;
    });
    const ageDist = Object.entries(ageBuckets).map(([range, count]) => ({ range, count }));

    // Status distribution
    const statusMap: Record<string, number> = {};
    data.forEach(r => {
      const status = String(r['Status'] || 'Unknown').trim();
      if (status) statusMap[status] = (statusMap[status] || 0) + 1;
    });
    const statusDist = Object.entries(statusMap).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 10);

    return { category, pie, ageDist, statusDist };
  }, [analysis, data]);

  // Dialog functions
  const openDataset = (name: string, dataRows: DataRow[], description: string) => {
    setSelectedDataset({ name, data: dataRows, description });
    setDialogSearchTerm('');
    setDialogSortColumn('');
  };

  const exportDatasetToExcel = () => {
    if (!selectedDataset) return;
    const worksheet = XLSX.utils.json_to_sheet(selectedDataset.data);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Data');
    XLSX.writeFile(workbook, `${selectedDataset.name.replace(/\s+/g, '_')}.xlsx`);
  };

  const exportAllToExcel = () => {
    const worksheet = XLSX.utils.json_to_sheet(filteredDataWithType);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'All Data');
    XLSX.writeFile(workbook, `ISS_Export_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  const exportToPDF = () => {
    if (!analysis) return;
    const doc = new jsPDF('landscape');
    doc.setFontSize(18);
    doc.text('ISS Dashboard Report', 14, 20);
    doc.setFontSize(10);
    doc.text(`File: ${fileName} | Generated: ${new Date().toLocaleString()}`, 14, 28);

    // Summary table
    const summaryData = [
      ['CRET', String(analysis.cret.count), String(analysis.cret.quantity)],
      ['Total Issues (Non-CRET)', String(analysis.totalIssues), String(analysis.totalQuantity)],
      ['FC Receive', String(analysis.fcReceive.count), String(analysis.fcReceive.quantity)],
      ['FC Actionable', String(analysis.fcActionable.count), String(analysis.fcActionable.quantity)],
      ['MFI', String(analysis.mfi.totalCount), '-'],
      ['RBS / PSAS', String(analysis.pendingRBS_PSAS.count), String(analysis.pendingRBS_PSAS.quantity)],
      ['Bin Check', String(analysis.binCheck.total), '-'],
      ['Others', String(analysis.others.count), String(analysis.others.quantity)],
    ];
    autoTable(doc, {
      startY: 35,
      head: [['Category', 'Issues', 'Quantity']],
      body: summaryData,
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
    });

    // Details table
    if (filteredDataWithType.length > 0) {
      const columns = Object.keys(filteredDataWithType[0]).slice(0, 8);
      doc.addPage();
      doc.setFontSize(14);
      doc.text('Data Details', 14, 20);
      autoTable(doc, {
        startY: 28,
        head: [columns],
        body: filteredDataWithType.slice(0, 200).map(r => columns.map(c => String(r[c] ?? '-').substring(0, 40))),
        theme: 'grid',
        headStyles: { fillColor: [59, 130, 246] },
        styles: { fontSize: 7 },
      });
    }

    doc.save(`ISS_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  const exportDatasetToPDF = () => {
    if (!selectedDataset || selectedDataset.data.length === 0) return;
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text(selectedDataset.name, 14, 20);
    doc.setFontSize(10);
    doc.text(selectedDataset.description, 14, 28);
    const cols = Object.keys(selectedDataset.data[0]).slice(0, 10);
    autoTable(doc, {
      startY: 35,
      head: [cols],
      body: selectedDataset.data.slice(0, 500).map(r => cols.map(c => String(r[c] ?? '-').substring(0, 40))),
      theme: 'grid',
      headStyles: { fillColor: [59, 130, 246] },
      styles: { fontSize: 7 },
    });
    doc.save(`${selectedDataset.name.replace(/\s+/g, '_')}.pdf`);
  };

  const getDialogFilteredData = () => {
    if (!selectedDataset) return [];
    let result = [...selectedDataset.data];
    if (dialogSearchTerm) {
      const term = dialogSearchTerm.toLowerCase();
      result = result.filter(row => Object.values(row).some(val => String(val).toLowerCase().includes(term)));
    }
    if (dialogSortColumn) {
      result.sort((a, b) => {
        const aVal = a[dialogSortColumn], bVal = b[dialogSortColumn];
        if (aVal == null) return dialogSortDirection === 'asc' ? -1 : 1;
        if (bVal == null) return dialogSortDirection === 'asc' ? 1 : -1;
        const aNum = Number(aVal), bNum = Number(bVal);
        if (!isNaN(aNum) && !isNaN(bNum)) return dialogSortDirection === 'asc' ? aNum - bNum : bNum - aNum;
        const cmp = String(aVal).localeCompare(String(bVal));
        return dialogSortDirection === 'asc' ? cmp : -cmp;
      });
    }
    return result;
  };

  const handleDialogSort = (col: string) => {
    if (dialogSortColumn === col) setDialogSortDirection(d => d === 'asc' ? 'desc' : 'asc');
    else { setDialogSortColumn(col); setDialogSortDirection('asc'); }
  };

  const columns = filteredDataWithType.length > 0 ? Object.keys(filteredDataWithType[0]) : (data.length > 0 ? Object.keys(data[0]) : []);

  // Upload screen
  if (data.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-950 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 bg-blue-600 rounded-2xl mb-6 shadow-lg shadow-blue-200">
              <FileSpreadsheet className="w-10 h-10 text-white" />
            </div>
            <h1 className="text-4xl font-bold text-slate-900 dark:text-slate-100 mb-3">{t.appTitle}</h1>
            <p className="text-lg text-slate-600 dark:text-slate-300">{t.uploadStart}</p>
          </div>
          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`relative border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${isDragging ? 'border-blue-500 bg-blue-50 shadow-lg shadow-blue-100' : 'border-slate-300 bg-white dark:bg-slate-900 dark:border-slate-700 hover:border-blue-400 hover:bg-slate-50 dark:hover:bg-slate-800'}`}
          >
            <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileInput} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
            <div className="flex flex-col items-center">
              <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 transition-colors ${isDragging ? 'bg-blue-100' : 'bg-slate-100'}`}>
                <Upload className={`w-8 h-8 ${isDragging ? 'text-blue-600' : 'text-slate-500'}`} />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 dark:text-slate-100 mb-2">{isDragging ? t.uploadDrop : t.uploadDrag}</h3>
              <p className="text-slate-500 dark:text-slate-400 mb-4">{t.uploadBrowse}</p>
              <div className="flex gap-2">
                <Badge variant="secondary" className="text-xs">CSV</Badge>
                <Badge variant="secondary" className="text-xs">Excel</Badge>
              </div>
            </div>
          </div>
          {isLoading && (
            <div className="mt-8 text-center">
              <Progress className="w-full mb-3" />
              <p className="text-slate-600 dark:text-slate-300">{t.analyzing}</p>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950" dir={language === 'ar' ? 'rtl' : 'ltr'}>
      {/* Header */}
      <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-50">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
                <FileSpreadsheet className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-slate-900 dark:text-slate-100">{t.appTitle}</h1>
                <p className="text-xs text-slate-500 dark:text-slate-400">{fileName} - {data.length} {t.rows}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setLanguage(prev => prev === 'en' ? 'ar' : 'en')} className="gap-1.5 text-xs">
                <Languages className="w-3.5 h-3.5" /> {language.toUpperCase()}
              </Button>
              <Button variant="outline" size="sm" onClick={() => setDarkMode(prev => !prev)} className="gap-1.5 text-xs">
                {darkMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                {t.darkMode}
              </Button>
              <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5 text-xs">
                <FileDown className="w-3.5 h-3.5" /> PDF
              </Button>
              <Button variant="outline" size="sm" onClick={exportAllToExcel} className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Excel
              </Button>
              <Button variant="outline" size="sm" onClick={clearData} className="gap-1.5 text-xs">
                <X className="w-3.5 h-3.5" /> {t.clear}
              </Button>
              <label className="cursor-pointer">
                <input type="file" accept=".csv,.xlsx,.xls" onChange={handleFileInput} className="hidden" />
                <Button variant="default" size="sm" className="gap-1.5 text-xs" asChild>
                  <span><Upload className="w-3.5 h-3.5" /> {t.newFile}</span>
                </Button>
              </label>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="mb-6">
            <TabsTrigger value="dashboard" className="gap-2"><Activity className="w-4 h-4" /> {t.dashboard}</TabsTrigger>
            <TabsTrigger value="charts" className="gap-2"><BarChart3 className="w-4 h-4" /> {t.charts}</TabsTrigger>
            <TabsTrigger value="explorer" className="gap-2"><Search className="w-4 h-4" /> {t.explorer}</TabsTrigger>
            <TabsTrigger value="reconciliation" className="gap-2"><GitCompareArrows className="w-4 h-4" /> {t.reconciliation}</TabsTrigger>
          </TabsList>

          {/* DASHBOARD TAB */}
          <TabsContent value="dashboard">
            <Card className="mb-4">
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><Settings className="w-4 h-4" /> {t.settings}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">FC Receive {t.ageThreshold}</label>
                    <Input type="number" value={settings.fcReceiveAgeThreshold} onChange={e => setSettings(prev => ({ ...prev, fcReceiveAgeThreshold: Number(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">FC Actionable {t.ageThreshold}</label>
                    <Input type="number" value={settings.fcActionableAgeThreshold} onChange={e => setSettings(prev => ({ ...prev, fcActionableAgeThreshold: Number(e.target.value) || 0 }))} />
                  </div>
                  <div>
                    <label className="text-xs text-slate-500 mb-1 block">MFI {t.ageThreshold}</label>
                    <Input type="number" value={settings.mfiAgeThreshold} onChange={e => setSettings(prev => ({ ...prev, mfiAgeThreshold: Number(e.target.value) || 0 }))} />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-4">
              {/* CRET */}
              <Card className="border-l-4 border-l-gray-600 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => analysis && openDataset('CRET', analysis.cret.data, 'Records with cret in Title, C-Return/Customer Return in Item, or tsCret in PhysicalLocation')}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-gray-600" />CRET</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-gray-700">{analysis?.cret.count.toLocaleString()}</div>
                  <div className="flex items-center gap-2 mt-2"><Package className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">Qty: {analysis?.cret.quantity.toLocaleString()}</span></div>
                </CardContent>
              </Card>

              {/* Total Issues */}
              <Card className="border-l-4 border-l-blue-500 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => {
                  const nonCret = data.filter(row => {
                    const t = String(row['Title'] || '').toLowerCase(); const i = String(row['Item'] || '').toLowerCase(); const l = String(row['PhysicalLocation'] || '').toLowerCase();
                    return !(t.includes('cret') || i.includes('c-return') || i.includes('customer return') || l.includes('tscret'));
                  });
                  openDataset('Total Issues (Non-CRET)', nonCret, 'All non-CRET issues');
                }}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4" />Total Issues</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-900">{analysis?.totalIssues.toLocaleString()}</div>
                  <div className="flex items-center gap-2 mt-2"><Package className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">Qty: {analysis?.totalQuantity.toLocaleString()}</span></div>
                </CardContent>
              </Card>

              {/* FC Receive */}
              <Card className="border-l-4 border-l-emerald-500 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => analysis && openDataset('FC Receive', analysis.fcReceive.data, 'PendingReason contains "fc receive"')}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-emerald-500" />FC Receive</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-emerald-600">{analysis?.fcReceive.count.toLocaleString()}</div>
                  <div className="flex items-center gap-2 mt-2"><Package className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">Qty: {analysis?.fcReceive.quantity.toLocaleString()}</span></div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-red-500"><Clock className="w-3 h-3" />{t.overDays(settings.fcReceiveAgeThreshold)}: {analysis?.fcReceive.ageOverThreshold}</div>
                </CardContent>
              </Card>

              {/* FC Actionable */}
              <Card className="border-l-4 border-l-amber-500 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => analysis && openDataset('FC Actionable', analysis.fcActionable.data, 'PendingReason contains "requester information - fc actionable"')}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-amber-500" />FC Actionable</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-amber-600">{analysis?.fcActionable.count.toLocaleString()}</div>
                  <div className="flex items-center gap-2 mt-2"><Package className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">Qty: {analysis?.fcActionable.quantity.toLocaleString()}</span></div>
                  <div className="flex items-center gap-1 mt-1 text-xs text-red-500"><Clock className="w-3 h-3" />{t.overDays(settings.fcActionableAgeThreshold)}: {analysis?.fcActionable.ageOverThreshold}</div>
                </CardContent>
              </Card>

              {/* MFI */}
              <Card className="border-l-4 border-l-purple-500 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => analysis && openDataset('MFI', analysis.mfi.data, 'Item contains "FBA Missing from Inbound"')}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-purple-500" />MFI</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-purple-600">{analysis?.mfi.totalCount.toLocaleString()}</div>
                  <div className="flex flex-col gap-1 mt-2 text-xs">
                    <span className="flex items-center gap-1 text-red-500"><Clock className="w-3 h-3" />{t.overDays(settings.mfiAgeThreshold)}: {analysis?.mfi.ageOverThreshold}</span>
                    <span className="flex items-center gap-1 text-blue-500"><Activity className="w-3 h-3" />WIP: {analysis?.mfi.workInProgress}</span>
                  </div>
                </CardContent>
              </Card>

              {/* RBS / PSAS */}
              <Card className="border-l-4 border-l-cyan-500 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => analysis && openDataset('RBS / PSAS', analysis.pendingRBS_PSAS.data, 'Pending with RBS / PSAS items')}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-cyan-500" />RBS / PSAS</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-cyan-600">{analysis?.pendingRBS_PSAS.count.toLocaleString()}</div>
                  <div className="flex items-center gap-2 mt-2"><Package className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">Qty: {analysis?.pendingRBS_PSAS.quantity.toLocaleString()}</span></div>
                </CardContent>
              </Card>

              {/* Bin Check */}
              <Card className="border-l-4 border-l-rose-500 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => analysis && openDataset('Bin Check', analysis.binCheck.allData, 'Andon Cord + Bin Check Request')}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-rose-500" />Bin Check</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-rose-600">{analysis?.binCheck.total.toLocaleString()}</div>
                  <div className="flex flex-col gap-1 mt-2 text-xs">
                    <span className="text-slate-600">Andon: {analysis?.binCheck.andonCord}</span>
                    <span className="text-slate-600">Bin Req: {analysis?.binCheck.binCheckRequest}</span>
                  </div>
                </CardContent>
              </Card>

              {/* Others */}
              <Card className="border-l-4 border-l-slate-400 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => analysis && openDataset('Others', analysis.others.data, 'Uncategorized records')}>
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-slate-500 flex items-center gap-2"><AlertCircle className="w-4 h-4 text-slate-400" />Others</CardTitle></CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold text-slate-600">{analysis?.others.count.toLocaleString()}</div>
                  <div className="flex items-center gap-2 mt-2"><Package className="w-4 h-4 text-slate-400" /><span className="text-sm text-slate-600">Qty: {analysis?.others.quantity.toLocaleString()}</span></div>
                </CardContent>
              </Card>
            </div>

            {/* Quick summary bar chart below cards */}
            <Card className="mt-6">
              <CardHeader><CardTitle className="text-base flex items-center gap-2"><TrendingUp className="w-5 h-5 text-blue-600" />Issues by Category</CardTitle></CardHeader>
              <CardContent>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData.category}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                      <YAxis />
                      <RTooltip />
                      <Bar dataKey="issues" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* CHARTS TAB */}
          <TabsContent value="charts">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Pie Chart */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><PieChart className="w-5 h-5 text-purple-600" />Issues Distribution</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <RPieChart>
                        <Pie data={chartData.pie} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                          {chartData.pie.map((_, idx) => <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />)}
                        </Pie>
                        <RTooltip />
                        <Legend />
                      </RPieChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Bar Chart - Issues vs Quantity */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><BarChart3 className="w-5 h-5 text-blue-600" />Issues vs Quantity</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.category}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis />
                        <RTooltip />
                        <Legend />
                        <Bar dataKey="issues" fill="#3b82f6" name="Issues" radius={[4, 4, 0, 0]} />
                        <Bar dataKey="quantity" fill="#10b981" name="Quantity" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Age Distribution */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Clock className="w-5 h-5 text-amber-600" />Age Distribution (Days)</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={chartData.ageDist}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="range" />
                        <YAxis />
                        <RTooltip />
                        <Area type="monotone" dataKey="count" fill="#f59e0b" stroke="#d97706" fillOpacity={0.3} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>

              {/* Status Distribution */}
              <Card>
                <CardHeader><CardTitle className="text-base flex items-center gap-2"><Activity className="w-5 h-5 text-emerald-600" />Top Statuses</CardTitle></CardHeader>
                <CardContent>
                  <div className="h-80">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={chartData.statusDist} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 11 }} />
                        <RTooltip />
                        <Bar dataKey="value" fill="#6366f1" radius={[0, 4, 4, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* DATA EXPLORER TAB */}
          <TabsContent value="explorer">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <CardTitle className="text-base">{t.explorer}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">{filteredDataWithType.length} / {data.length} {t.rows}</Badge>
                    <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)} className="gap-1.5 text-xs">
                      <Filter className="w-3.5 h-3.5" /> {t.filters}
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportAllToExcel} className="gap-1.5 text-xs">
                      <Download className="w-3.5 h-3.5" /> Excel
                    </Button>
                    <Button variant="outline" size="sm" onClick={exportToPDF} className="gap-1.5 text-xs">
                      <FileDown className="w-3.5 h-3.5" /> PDF
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {typeBreakdown.length > 0 && (
                  <div className="mb-4 rounded-lg border bg-slate-50 p-3">
                    <p className="text-xs font-semibold text-slate-600 mb-2">{t.typeBreakdown}</p>
                    <div className="flex flex-wrap gap-2">
                      {typeBreakdown.map(([type, count]) => (
                        <Badge key={type} variant="secondary">{type}: {count}</Badge>
                      ))}
                    </div>
                  </div>
                )}
                {/* Global search */}
                <div className="relative mb-4">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input placeholder="Search all columns..." value={globalSearch} onChange={e => setGlobalSearch(e.target.value)} className="pl-9" />
                </div>

                {/* Advanced Filters */}
                {showFilters && (
                  <div className="bg-slate-50 rounded-lg p-4 mb-4 space-y-3">
                    <h4 className="text-sm font-semibold text-slate-700 flex items-center gap-2"><Filter className="w-4 h-4" /> {t.filters}</h4>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Status</label>
                        <Input placeholder="Filter by status..." value={statusFilter} onChange={e => setStatusFilter(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">{t.pendingReason}</label>
                        <Input placeholder="FC Receive / Actionable..." value={pendingReasonFilter} onChange={e => setPendingReasonFilter(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">{t.category}</label>
                        <select className="w-full h-10 rounded-md border border-input bg-background px-3 text-sm" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}>
                          <option value="">All</option>
                          <option value="CRET">CRET</option>
                          <option value="FC Receive">FC Receive</option>
                          <option value="FC Actionable">FC Actionable</option>
                          <option value="MFI">MFI</option>
                          <option value="RBS / PSAS">RBS / PSAS</option>
                          <option value="Bin Check">Bin Check</option>
                          <option value="Others">Others</option>
                        </select>
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Age Min</label>
                        <Input type="number" placeholder="Min age..." value={ageFilterMin} onChange={e => setAgeFilterMin(e.target.value)} />
                      </div>
                      <div>
                        <label className="text-xs text-slate-500 mb-1 block">Age Max</label>
                        <Input type="number" placeholder="Max age..." value={ageFilterMax} onChange={e => setAgeFilterMax(e.target.value)} />
                      </div>
                    </div>
                    {/* Column-specific filters */}
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                      {columns.slice(0, 8).map(col => (
                        <div key={col}>
                          <label className="text-xs text-slate-500 mb-1 block">{col}</label>
                          <Input placeholder={`Filter ${col}...`} value={columnFilters[col] || ''} onChange={e => setColumnFilters(prev => ({ ...prev, [col]: e.target.value }))} className="text-xs h-8" />
                        </div>
                      ))}
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => { setColumnFilters({}); setAgeFilterMin(''); setAgeFilterMax(''); setStatusFilter(''); setPendingReasonFilter(''); setCategoryFilter(''); setGlobalSearch(''); }}>
                      {t.clearAllFilters}
                    </Button>
                  </div>
                )}

                {/* Table */}
                <ScrollArea className="border rounded-lg" style={{ height: '500px' }}>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50 sticky top-0 z-10">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-slate-500 border-b text-xs">#</th>
                          {columns.map(col => (
                            <th key={col} className="px-3 py-2 text-left font-medium text-slate-700 border-b border-slate-200 whitespace-nowrap text-xs">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDataWithType.slice(0, 500).map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50 transition-colors">
                            <td className="px-3 py-1.5 border-b border-slate-100 text-xs text-slate-400">{idx + 1}</td>
                            {columns.map(col => (
                              <td key={col} className="px-3 py-1.5 border-b border-slate-100 whitespace-nowrap max-w-[200px] overflow-hidden text-ellipsis text-xs">
                                {row[col] != null ? String(row[col]) : '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </ScrollArea>
                {filteredDataWithType.length > 500 && <p className="text-xs text-slate-500 mt-2 text-center">Showing first 500 of {filteredDataWithType.length} rows</p>}
              </CardContent>
            </Card>
          </TabsContent>

          {/* SHIFT RECONCILIATION TAB */}
          <TabsContent value="reconciliation">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2"><GitCompareArrows className="w-5 h-5 text-indigo-600" /> {t.reconciliation}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-semibold mb-2">{t.startShift}</p>
                    <label className="cursor-pointer">
                      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleShiftFileInput(f, 'start');
                      }} />
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild><span><Upload className="w-3.5 h-3.5" /> {startShiftFileName || t.uploadStartFile}</span></Button>
                    </label>
                    <p className="text-xs text-slate-500 mt-2">{startShiftData.length} rows</p>
                  </div>
                  <div className="rounded-lg border p-3">
                    <p className="text-sm font-semibold mb-2">{t.endShift}</p>
                    <label className="cursor-pointer">
                      <input type="file" accept=".csv,.xlsx,.xls" className="hidden" onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) handleShiftFileInput(f, 'end');
                      }} />
                      <Button variant="outline" size="sm" className="gap-1.5 text-xs" asChild><span><Upload className="w-3.5 h-3.5" /> {endShiftFileName || t.uploadEndFile}</span></Button>
                    </label>
                    <p className="text-xs text-slate-500 mt-2">{endShiftData.length} rows</p>
                  </div>
                </div>

                <Button onClick={() => compareShiftData(startShiftData, endShiftData)} disabled={!startShiftData.length || !endShiftData.length} className="gap-1.5">
                  <GitCompareArrows className="w-4 h-4" /> {t.compareNow}
                </Button>

                {shiftDiffRows.length > 0 && (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
                      <Badge variant="secondary">{t.added}: {shiftDiffRows.filter(r => r.changeType === 'added').length}</Badge>
                      <Badge variant="secondary">{t.removed}: {shiftDiffRows.filter(r => r.changeType === 'removed').length}</Badge>
                      <Badge variant="secondary">{t.qtyIncreased}: {shiftDiffRows.filter(r => r.changeType === 'qty_increased').length}</Badge>
                      <Badge variant="secondary">{t.qtyDecreased}: {shiftDiffRows.filter(r => r.changeType === 'qty_decreased').length}</Badge>
                      <Badge variant="secondary">{t.statusChanged}: {shiftDiffRows.filter(r => r.changeType === 'status_changed').length}</Badge>
                      <Badge variant="secondary">{t.typeChanged}: {shiftDiffRows.filter(r => r.changeType === 'type_changed').length}</Badge>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-semibold mb-2">{t.compareSummary}</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-900">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs">{t.issueType}</th>
                              <th className="px-3 py-2 text-left text-xs">{t.added}</th>
                              <th className="px-3 py-2 text-left text-xs">{t.removed}</th>
                              <th className="px-3 py-2 text-left text-xs">{t.qtyIncreased}</th>
                              <th className="px-3 py-2 text-left text-xs">{t.qtyDecreased}</th>
                              <th className="px-3 py-2 text-left text-xs">{t.statusChanged}</th>
                              <th className="px-3 py-2 text-left text-xs">{t.typeChanged}</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftTypeSummary.map(([type, s]) => (
                              <tr key={type} className="border-b dark:border-slate-800">
                                <td className="px-3 py-1.5 text-xs font-medium">{type}</td>
                                <td className="px-3 py-1.5 text-xs">{s.added}</td>
                                <td className="px-3 py-1.5 text-xs">{s.removed}</td>
                                <td className="px-3 py-1.5 text-xs">{s.qtyIncreased}</td>
                                <td className="px-3 py-1.5 text-xs">{s.qtyDecreased}</td>
                                <td className="px-3 py-1.5 text-xs">{s.statusChanged}</td>
                                <td className="px-3 py-1.5 text-xs">{s.typeChanged}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    <div className="rounded-lg border p-3">
                      <p className="text-sm font-semibold mb-2">{t.transitionSummary}</p>
                      {typeTransitions.length === 0 ? (
                        <p className="text-xs text-slate-500 dark:text-slate-400">{t.noTransitions}</p>
                      ) : (
                        <div className="flex flex-wrap gap-2">
                          {typeTransitions.map(([k, v]) => <Badge key={k} variant="outline">{k}: {v}</Badge>)}
                        </div>
                      )}
                    </div>

                    <ScrollArea className="border rounded-lg" style={{ height: '420px' }}>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                            <tr>
                              <th className="px-3 py-2 text-left text-xs">Type</th>
                              <th className="px-3 py-2 text-left text-xs">{t.fromType}</th>
                              <th className="px-3 py-2 text-left text-xs">{t.toType}</th>
                              <th className="px-3 py-2 text-left text-xs">Item</th>
                              <th className="px-3 py-2 text-left text-xs">Title</th>
                              <th className="px-3 py-2 text-left text-xs">Start Qty</th>
                              <th className="px-3 py-2 text-left text-xs">End Qty</th>
                              <th className="px-3 py-2 text-left text-xs">Delta</th>
                              <th className="px-3 py-2 text-left text-xs">Start Status</th>
                              <th className="px-3 py-2 text-left text-xs">End Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {shiftDiffRows.map((row) => (
                              <tr key={row.key} className="border-b">
                                <td className="px-3 py-1.5 text-xs">{getChangeTypeLabel(row.changeType)}</td>
                                <td className="px-3 py-1.5 text-xs">{row.startIssueType}</td>
                                <td className="px-3 py-1.5 text-xs">{row.endIssueType}</td>
                                <td className="px-3 py-1.5 text-xs">{row.item || '-'}</td>
                                <td className="px-3 py-1.5 text-xs max-w-[220px] truncate">{row.title || '-'}</td>
                                <td className="px-3 py-1.5 text-xs">{row.startQty}</td>
                                <td className="px-3 py-1.5 text-xs">{row.endQty}</td>
                                <td className={`px-3 py-1.5 text-xs ${row.qtyDelta > 0 ? 'text-emerald-600' : row.qtyDelta < 0 ? 'text-red-600' : ''}`}>{row.qtyDelta}</td>
                                <td className="px-3 py-1.5 text-xs">{row.startStatus || '-'}</td>
                                <td className="px-3 py-1.5 text-xs">{row.endStatus || '-'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </ScrollArea>
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>

      <footer className="border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-950">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <p className="text-sm text-slate-700 dark:text-slate-300">{t.executionBy}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">{t.supportContact}</p>
        </div>
      </footer>

      {/* Detail Dialog */}
      <Dialog open={!!selectedDataset} onOpenChange={() => setSelectedDataset(null)}>
        <DialogContent className="max-w-7xl max-h-[90vh] overflow-hidden flex flex-col bg-white dark:bg-slate-950 border-slate-200 dark:border-slate-800 shadow-2xl">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="text-xl flex items-center gap-2">
                <Button variant="ghost" size="sm" onClick={() => setSelectedDataset(null)} className="gap-1"><ChevronLeft className="w-4 h-4" />Back</Button>
                {selectedDataset?.name}
              </DialogTitle>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={exportDatasetToPDF} className="gap-2"><FileDown className="w-4 h-4" />PDF</Button>
                <Button variant="outline" size="sm" onClick={exportDatasetToExcel} className="gap-2"><Download className="w-4 h-4" />Excel</Button>
              </div>
            </div>
            <p className="text-sm text-slate-500 dark:text-slate-400">{selectedDataset?.description}</p>
          </DialogHeader>

          <div className="flex items-center gap-2 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <Input placeholder="Search..." value={dialogSearchTerm} onChange={e => setDialogSearchTerm(e.target.value)} className="pl-9 bg-white dark:bg-slate-900" />
            </div>
            <Badge variant="secondary" className="h-10 px-3">{getDialogFilteredData().length} rows</Badge>
          </div>

          <ScrollArea className="flex-1 border border-slate-200 dark:border-slate-800 rounded-lg bg-white dark:bg-slate-900">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 dark:bg-slate-900 sticky top-0 z-10">
                  <tr>
                    {columns.map(col => (
                      <th key={col} onClick={() => handleDialogSort(col)} className="px-4 py-3 text-left font-medium text-slate-700 dark:text-slate-200 border-b border-slate-200 dark:border-slate-800 cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors whitespace-nowrap">
                        <div className="flex items-center gap-1">
                          {col}
                          {dialogSortColumn === col && (dialogSortDirection === 'asc' ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {getDialogFilteredData().map((row, idx) => (
                    <tr key={idx} className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors">
                      {columns.map(col => (
                        <td key={col} className="px-4 py-2 border-b border-slate-100 dark:border-slate-800 whitespace-nowrap max-w-xs overflow-hidden text-ellipsis text-slate-800 dark:text-slate-100">
                          {row[col] != null ? String(row[col]) : '-'}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
