"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Papa from "papaparse";
import { toast } from "sonner";

import {
  Building2,
  CheckCircle2,
  Clock,
  UploadCloud,
  FileDown,
  FileSpreadsheet,
  Info,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Languages,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";

import { slugifyId } from "@/lib/services/InventoryService";
import { db } from "@/lib/firebase";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";

/* ============================ i18n ============================ */

type Lang = "th" | "en";
const copy: Record<Lang, Record<string, string>> = {
  th: {
    title: "เข้าร่วม TransferNet",
    subtitle: "ส่งคำขอสร้างสาขา (แนบสต็อก CSV ได้) และรอผู้ดูแลระบบอนุมัติ",
    adminNote: "ผู้ดูแลระบบต้องอนุมัติก่อนจึงจะสร้างสาขา",
    stepInfo: "ข้อมูลธุรกิจ",
    stepImport: "นำเข้าสินค้าคงคลัง",
    stepReview: "ตรวจสอบ & ส่งคำขอ",
    bizName: "ชื่อสาขา/ธุรกิจ *",
    location: "ที่อยู่ (สั้น ๆ) *",
    contact: "ผู้ติดต่อ *",
    email: "อีเมล *",
    phone: "โทรศัพท์",
    agree: "ยอมรับเงื่อนไขและนโยบายความเป็นส่วนตัว",
    next: "ถัดไป",
    back: "ย้อนกลับ",
    importTitle: "นำเข้าสินค้าคงคลัง (CSV)",
    importDesc: "อัปโหลดไฟล์สต็อกและแมพคอลัมน์ หรือข้ามขั้นตอนนี้ได้",
    dragHere: "ลากไฟล์ .csv มาวางที่นี่ หรือ",
    chooseCSV: "เลือกไฟล์ CSV",
    downloadTemplate: "ดาวน์โหลดเทมเพลต",
    selected: "ไฟล์ที่เลือก:",
    treatNull: "เว้นว่าง promoPrice = null",
    allowEmptyDot: "ยอมให้คอลัมน์ DOT ว่างได้",
    clear: "ล้างข้อมูล",
    mappingComplete: "แมพคอลัมน์ครบแล้ว",
    mappingRequired: "โปรดแมพคอลัมน์ที่จำเป็น",
    withoutDot: "แถวที่ไม่มี DOT",
    reviewTitle: "ตรวจสอบ & ส่งคำขอ",
    reviewDesc: "ยืนยันข้อมูล ระบบจะส่งให้ผู้ดูแลอนุมัติ",
    nameLabel: "ชื่อ:",
    locLabel: "ที่อยู่:",
    contactLabel: "ผู้ติดต่อ:",
    emailLabel: "อีเมล:",
    phoneLabel: "โทรศัพท์:",
    storeIdLabel: "Store ID (เสนอ):",
    invAttached: "แถวที่จะถูกแนบกับคำขอ",
    invNone: "ยังไม่ได้แนบ CSV สามารถนำเข้าภายหลังได้",
    submit: "ส่งคำขอ",
    submitting: "กำลังส่ง...",
    doneTitle: "ส่งคำขอแล้ว",
    doneDesc: "ระบบจะตรวจสอบและเปิดใช้งานสาขาหลังจากผู้ดูแลอนุมัติ",
    goDashboard: "ไปหน้าแดชบอร์ด",
    importMore: "นำเข้าสต็อกเพิ่ม",
  },
  en: {
    title: "Join TransferNet",
    subtitle: "Submit a branch application (optionally attach CSV) and wait for admin approval",
    adminNote: "Admin approval is required before the branch is created",
    stepInfo: "Business Information",
    stepImport: "Inventory Import",
    stepReview: "Review & Submit",
    bizName: "Business / Branch Name *",
    location: "Location (short) *",
    contact: "Contact Name *",
    email: "Email Address *",
    phone: "Phone Number",
    agree: "I agree to the terms and privacy policy.",
    next: "Next",
    back: "Back",
    importTitle: "Import Inventory (CSV)",
    importDesc: "Upload your stock CSV and map columns, or skip and import later.",
    dragHere: "Drag & drop a .csv here, or",
    chooseCSV: "Choose CSV",
    downloadTemplate: "Download template",
    selected: "Selected:",
    treatNull: "Treat empty promoPrice as null",
    allowEmptyDot: "Allow empty DOT column",
    clear: "Clear",
    mappingComplete: "Mapping complete",
    mappingRequired: "Please map required columns",
    withoutDot: "without DOT",
    reviewTitle: "Review & Submit",
    reviewDesc: "Confirm details. This will be sent for admin approval.",
    nameLabel: "Name:",
    locLabel: "Location:",
    contactLabel: "Contact:",
    emailLabel: "Email:",
    phoneLabel: "Phone:",
    storeIdLabel: "Store ID (proposed):",
    invAttached: "rows will be attached to your application.",
    invNone: "No CSV attached. You can import after approval.",
    submit: "Submit Application",
    submitting: "Submitting...",
    doneTitle: "Application Submitted",
    doneDesc: "We will verify your business and activate the branch after admin approval.",
    goDashboard: "Go to Dashboard",
    importMore: "Import more stock",
  },
};

/* ============================ Types ============================ */

type BusinessForm = {
  businessName: string;
  location: string;
  contactName: string;
  email: string;
  phone: string;
  agree: boolean;
};

type ImportRow = {
  sku?: string;
  brand: string;
  model: string;
  size: string;
  loadIndex?: string;
  dotCode: string;
  qty: number;
  basePrice?: number;
  promoPrice?: number | null;
};

const DEFAULT_BIZ: BusinessForm = {
  businessName: "",
  location: "",
  contactName: "",
  email: "",
  phone: "",
  agree: false,
};

/* =================== Child Components (top-level) =================== */

type StepperProps = {
  lang: Lang;
  setLang: (l: Lang) => void;
  progress: number;
  t: (k: string) => string;
  step: number;
};
const Stepper = React.memo(function Stepper({ lang, setLang, progress, t, step }: StepperProps) {
  const items = [
    { key: 0, label: t("stepInfo"), status: step > 0 ? "Complete" : "In Progress" },
    { key: 1, label: t("stepImport"), status: step > 1 ? "Complete" : step === 1 ? "In Progress" : "Pending" },
    { key: 2, label: t("stepReview"), status: step === 2 ? "In Progress" : step > 2 ? "Complete" : "Pending" },
  ];

  return (
    <div className="space-y-3">
      <div className="rounded-xl border p-3 bg-white flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Languages className="h-4 w-4" />
          <span className="text-sm font-medium">{lang.toUpperCase()}</span>
        </div>
        <div className="flex gap-1">
          <Button size="sm" variant={lang === "th" ? "default" : "outline"} onClick={() => setLang("th")}>ไทย</Button>
          <Button size="sm" variant={lang === "en" ? "default" : "outline"} onClick={() => setLang("en")}>EN</Button>
        </div>
      </div>

      <Progress value={progress} />

      {items.map((s) => (
        <div key={s.key} className="flex items-center justify-between rounded-xl border p-3 bg-white">
          <div className="flex items-center gap-2">
            {s.status === "Complete" ? <CheckCircle2 className="h-4 w-4 text-green-600" /> :
              s.status === "In Progress" ? <Clock className="h-4 w-4 text-amber-600" /> :
                <ShieldCheck className="h-4 w-4 text-slate-400" />}
            <div className="text-sm font-medium">{s.label}</div>
          </div>
          <div className="text-xs text-muted-foreground">{s.status}</div>
        </div>
      ))}
    </div>
  );
});

type StepBusinessInfoProps = {
  t: (k: string) => string;
  lang: Lang;
  biz: BusinessForm;
  setBiz: React.Dispatch<React.SetStateAction<BusinessForm>>;
  bizValid: boolean;
  onNext: () => void;
  nameRef: React.RefObject<HTMLInputElement | null>; // 👈 แก้ให้รองรับ null
};
const StepBusinessInfo = React.memo(function StepBusinessInfo({
  t, lang, biz, setBiz, bizValid, onNext, nameRef,
}: StepBusinessInfoProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <Building2 className="h-5 w-5" /> {t("stepInfo")}
        </CardTitle>
        <CardDescription>
          {lang === "th" ? "กรอกเฉพาะข้อมูลจำเป็นสำหรับสร้างคำขอ" : "Fill only what we need to set up your application."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label className="text-xs">{t("bizName")}</Label>
            <Input
              ref={nameRef}
              className="mt-1"
              autoComplete="organization"
              value={biz.businessName}
              onChange={(e) => setBiz((prev) => ({ ...prev, businessName: e.target.value }))}
              placeholder="ABC Tire Rama 2"
            />
          </div>
          <div className="md:col-span-2">
            <Label className="text-xs">{t("location")}</Label>
            <Input
              className="mt-1"
              autoComplete="address-line1"
              value={biz.location}
              onChange={(e) => setBiz((prev) => ({ ...prev, location: e.target.value }))}
              placeholder={lang === "th" ? "ที่อยู่บรรทัดเดียว" : "Address line 1"}
            />
          </div>
          <div>
            <Label className="text-xs">{t("contact")}</Label>
            <Input
              className="mt-1"
              autoComplete="name"
              value={biz.contactName}
              onChange={(e) => setBiz((prev) => ({ ...prev, contactName: e.target.value }))}
              placeholder={lang === "th" ? "ชื่อผู้ติดต่อ" : "Primary contact"}
            />
          </div>
          <div>
            <Label className="text-xs">{t("email")}</Label>
            <Input
              className="mt-1"
              type="email"
              autoComplete="email"
              value={biz.email}
              onChange={(e) => setBiz((prev) => ({ ...prev, email: e.target.value }))}
              placeholder="business@example.com"
            />
          </div>
          <div>
            <Label className="text-xs">{t("phone")}</Label>
            <Input
              className="mt-1"
              type="tel"
              autoComplete="tel"
              value={biz.phone}
              onChange={(e) => setBiz((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="+66 ..."
            />
          </div>
        </div>

        <Separator />

        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Switch
              id="agree"
              checked={biz.agree}
              onCheckedChange={(checked) => setBiz((prev) => ({ ...prev, agree: Boolean(checked) }))}
            />
            <Label htmlFor="agree" className="text-sm">{t("agree")}</Label>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" disabled className="gap-2">
              <ArrowLeft className="h-4 w-4" />{t("back")}
            </Button>
            <Button onClick={onNext} disabled={!bizValid} className="gap-2">
              {t("next")} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
});

type StepImportProps = {
  t: (k: string) => string;
  lang: Lang;
  headers: string[];
  fileName: string;
  mapping: Record<string, string | "">;
  setMapping: (m: Record<string, string | "">) => void;
  treatEmptyPromoAsNull: boolean;
  setTreatEmptyPromoAsNull: (b: boolean) => void;
  allowEmptyDot: boolean;
  setAllowEmptyDot: (b: boolean) => void;
  mappedRows: ImportRow[];
  mappingValid: boolean;
  bizValid: boolean;
  rowsCount: number;
  onChooseFile: () => void;
  csvInputRef: React.RefObject<HTMLInputElement | null>; // 👈 แก้ให้รองรับ null
  onFileChange: (f: File) => void;
  onDropCSV: (e: React.DragEvent<HTMLDivElement>) => void;
  onNext: () => void;
  onPrev: () => void;
  onClear: () => void;
  downloadTemplate: () => void;
};
const StepImport = React.memo(function StepImport(props: StepImportProps) {
  const REQUIRED_KEYS = ["sku","brand","model","size","loadIndex","dotCode","qty","basePrice","promoPrice"] as const;
  const noDotCount = useMemo(() => props.mappedRows.filter((r) => !r.dotCode).length, [props.mappedRows]);
  const statusText =
    (props.mappingValid ? props.t("mappingComplete") : props.t("mappingRequired")) +
    ((!props.allowEmptyDot && noDotCount) ? (" • " + noDotCount + " " + props.t("withoutDot")) : "");

  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <FileSpreadsheet className="h-5 w-5" />{props.t("importTitle")}
        </CardTitle>
        <CardDescription>{props.t("importDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div
          className="rounded-xl border border-dashed p-6 flex flex-col items-center justify-center text-center bg-slate-50 hover:bg-slate-100 transition"
          onDragOver={(e) => e.preventDefault()}
          onDrop={props.onDropCSV}
        >
          <Input
            ref={props.csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) props.onFileChange(f);
            }}
          />
          <UploadCloud className="h-5 w-5 mb-2" />
          <p className="text-sm">{props.t("dragHere")}</p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <Button variant="outline" onClick={props.onChooseFile} className="gap-2">
              {props.t("chooseCSV")}
            </Button>
            <Button variant="ghost" onClick={props.downloadTemplate} className="gap-2">
              <FileDown className="h-4 w-4" />{props.t("downloadTemplate")}
            </Button>
            {props.fileName && <span className="text-xs text-muted-foreground">{props.t("selected")} {props.fileName}</span>}
          </div>
        </div>

        {!!props.headers.length && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {REQUIRED_KEYS.map((k) => (
                <div key={k}>
                  <Label className="text-xs uppercase tracking-wide">{k}</Label>
                  <Select value={(props.mapping[k] as string) || ""} onValueChange={(v) => props.setMapping({ ...props.mapping, [k]: v as any })}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select column" />
                    </SelectTrigger>
                    <SelectContent>
                      {props.headers.map((h) => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-6">
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={props.treatEmptyPromoAsNull} onCheckedChange={props.setTreatEmptyPromoAsNull} />
                {props.t("treatNull")}
              </label>
              <label className="flex items-center gap-2 text-xs">
                <Switch checked={props.allowEmptyDot} onCheckedChange={props.setAllowEmptyDot} />
                {props.t("allowEmptyDot")}
              </label>
              <Button variant="ghost" size="sm" onClick={props.onClear}>{props.t("clear")}</Button>
            </div>

            <div className="rounded-xl border overflow-hidden bg-white">
              <div className="px-3 py-2 text-xs bg-slate-50 flex items-center justify-between">
                <div>{"Preview (" + Math.min(10, props.mappedRows.length) + " of " + props.mappedRows.length + " rows)"}</div>
                <div className="text-muted-foreground">{statusText}</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-xs">
                  <thead className="bg-slate-50">
                    <tr>
                      {["sku","brand","model","size","loadIndex","dotCode","qty","basePrice","promoPrice"].map((k) => (
                        <th key={k} className="px-3 py-2 text-left font-medium">{k}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {props.mappedRows.slice(0, 10).map((r, i) => (
                      <tr key={i} className="border-b">
                        <td className="px-3 py-2">{r.sku || ""}</td>
                        <td className="px-3 py-2">{r.brand}</td>
                        <td className="px-3 py-2">{r.model}</td>
                        <td className="px-3 py-2">{r.size}</td>
                        <td className="px-3 py-2">{r.loadIndex || ""}</td>
                        <td className="px-3 py-2 font-mono">{r.dotCode}</td>
                        <td className="px-3 py-2">{r.qty}</td>
                        <td className="px-3 py-2">{r.basePrice ?? ""}</td>
                        <td className="px-3 py-2">{r.promoPrice ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={props.onPrev} className="gap-2">
            <ArrowLeft className="h-4 w-4" />{props.t("back")}
          </Button>
          <Button
            variant="outline"
            onClick={props.onNext}
            disabled={!props.bizValid || (!!props.rowsCount && !props.mappingValid)}
            className="gap-2"
          >
            {props.t("next")} <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

type StepReviewProps = {
  t: (k: string) => string;
  biz: BusinessForm;
  submitting: boolean;
  onPrev: () => void;
  onSubmit: () => void;
};
const StepReview = React.memo(function StepReview({ t, biz, submitting, onPrev, onSubmit }: StepReviewProps) {
  const storeId = slugifyId((biz.businessName || "").trim());
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5" /> {t("reviewTitle")}
        </CardTitle>
        <CardDescription>{t("reviewDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h3 className="text-sm font-semibold">{t("stepInfo")}</h3>
          <Separator className="my-2" />
          <ul className="text-sm space-y-1">
            <li><b>{t("nameLabel")}</b> {biz.businessName}</li>
            <li><b>{t("locLabel")}</b> {biz.location}</li>
            <li><b>{t("contactLabel")}</b> {biz.contactName}</li>
            <li><b>{t("emailLabel")}</b> {biz.email}</li>
            {biz.phone && <li><b>{t("phoneLabel")}</b> {biz.phone}</li>}
            <li><b>{t("storeIdLabel")}</b> <code>{storeId}</code></li>
          </ul>
        </div>
      </CardContent>
      <CardContent className="pt-0">
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={onPrev} className="gap-2">
            <ArrowLeft className="h-4 w-4" />{t("back")}
          </Button>
          <Button onClick={onSubmit} className="gap-2" disabled={submitting}>
            {submitting ? t("submitting") : (<><ArrowRight className="h-4 w-4" />{t("submit")}</>)}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
});

type StepDoneProps = { t: (k: string) => string; lang: Lang; onDone?: () => void; onImportMore: () => void; };
const StepDone = React.memo(function StepDone({ t, lang, onDone, onImportMore }: StepDoneProps) {
  return (
    <Card className="rounded-2xl shadow-sm">
      <CardHeader>
        <CardTitle className="text-lg flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600" />{t("doneTitle")}
        </CardTitle>
        <CardDescription>{t("doneDesc")}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">
          {lang === "th"
            ? "สามารถติดตามสถานะคำขอได้ที่หน้า Applications เมื่ออนุมัติแล้ว ระบบจะสร้างสาขาและนำเข้า CSV (ถ้ามี)"
            : "You can track your application status on the Applications page. Once approved, your branch will be created and (if provided) your CSV will be imported."}
        </p>
        <div className="flex gap-2">
          <Button onClick={() => onDone?.()}>{t("goDashboard")}</Button>
          <Button variant="outline" onClick={onImportMore}>{t("importMore")}</Button>
        </div>
      </CardContent>
    </Card>
  );
});

/* ============================ Main ============================ */

export default function AddBranchWizard({ onDone }: { onDone?: () => void }) {
  const [lang, setLang] = useState<Lang>("th");
  const t = (k: string) => copy[lang][k] || k;

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  const [biz, setBiz] = useState<BusinessForm>(DEFAULT_BIZ);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  // CSV states
  const REQUIRED_FIELDS = ["brand", "model", "size", "dotCode", "qty"] as const;
  const OPTIONAL_FIELDS = ["sku", "loadIndex", "basePrice", "promoPrice"] as const;
  type FieldKey = (typeof REQUIRED_FIELDS)[number] | (typeof OPTIONAL_FIELDS)[number];

  const [fileName, setFileName] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<any[]>([]);
  const [mapping, setMapping] = useState<Record<FieldKey, string | "">>({
    sku: "",
    brand: "",
    model: "",
    size: "",
    loadIndex: "",
    dotCode: "",
    qty: "",
    basePrice: "",
    promoPrice: "",
  });
  const [treatEmptyPromoAsNull, setTreatEmptyPromoAsNull] = useState(true);
  const [allowEmptyDot, setAllowEmptyDot] = useState(true);
  const csvInputRef = useRef<HTMLInputElement>(null);

  const bizValid = useMemo(() => {
    return (
      biz.businessName.trim() !== "" &&
      biz.location.trim() !== "" &&
      biz.contactName.trim() !== "" &&
      /.+@.+\..+/.test(biz.email) &&
      biz.agree
    );
  }, [biz]);

  const progress = useMemo(() => {
    const total = 3;
    return Math.round(((Math.min(step, 2) + 1) / total) * 100);
  }, [step]);

  function handleChooseFile() { csvInputRef.current?.click(); }
  function onDropCSV(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const f = e.dataTransfer.files?.[0];
    if (f && f.name.toLowerCase().endsWith(".csv")) parseCSV(f);
    else toast.error(lang === "th" ? "กรุณาวางไฟล์ .csv" : "Please drop a .csv file");
  }
  function parseCSV(file: File) {
    setFileName(file.name);
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = (res.meta.fields || []).map(String);
        const data = (res.data as any[]) || [];
        setHeaders(hs);
        setRows(data);
        toast.success((lang === "th" ? "โหลดข้อมูล " : "Loaded ") + data.length + (lang === "th" ? " แถว" : " rows"));
      },
      error: (err) => toast.error(err.message),
    });
  }

  const mappedRows: ImportRow[] = useMemo(() => {
    if (!rows.length) return [];
    return rows.map((r) => ({
      sku: mapping.sku ? String(r[mapping.sku]) : undefined,
      brand: mapping.brand ? String(r[mapping.brand]).trim() : "",
      model: mapping.model ? String(r[mapping.model]).trim() : "",
      size: mapping.size ? String(r[mapping.size]).trim() : "",
      loadIndex: mapping.loadIndex ? String(r[mapping.loadIndex]).trim() : undefined,
      dotCode: mapping.dotCode ? String(r[mapping.dotCode]).trim() : "",
      qty: mapping.qty ? Number(r[mapping.qty]) || 0 : 0,
      basePrice: mapping.basePrice ? Number(r[mapping.basePrice]) : undefined,
      promoPrice: mapping.promoPrice
        ? (r[mapping.promoPrice] === "" && treatEmptyPromoAsNull ? null : Number(r[mapping.promoPrice]))
        : null,
    }));
  }, [rows, mapping, treatEmptyPromoAsNull]);

  const mappingValid = useMemo(() => {
    if (!headers.length) return false;
    const required: FieldKey[] = ["brand", "model", "size", "qty"];
    const baseOk = required.every((k) => mapping[k] && headers.includes(mapping[k] as string));
    return allowEmptyDot ? baseOk : baseOk && Boolean(mapping.dotCode && headers.includes(mapping.dotCode as string));
  }, [headers, mapping, allowEmptyDot]);

  function downloadTemplate() {
    const cols = [
      "brand,model,size,loadIndex,dotCode,qty,basePrice,promoPrice,sku",
      "MICHELIN,e-PRIMACY,215/60R16,95H,2325,4,3200,2990,TY-MI-EPRI-2160-95H",
      "MICHELIN,e-PRIMACY,215/60R16,95H,2324,8,3200,,TY-MI-EPRI-2160-95H",
      "BRIDGESTONE,TURANZA T005A,225/45R17,,2319,2,3700,,-",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + cols], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "inventory_template.csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  function next() { setStep((s) => Math.min(s + 1, 3)); }
  function prev() { setStep((s) => Math.max(s - 1, 0)); }

  async function submitApplication() {
    if (submitting) return;
    const branchName = (biz.businessName || "").trim();
    if (!branchName) {
      toast.error(lang === "th" ? "กรุณากรอกชื่อสาขา/ธุรกิจ" : "Please enter business/branch name");
      return;
    }
    setSubmitting(true);

    const storeId = slugifyId(branchName);
    const noteBits: string[] = [];
    if (biz.location) noteBits.push("Location: " + biz.location);
    if (biz.contactName) {
      let c = biz.contactName;
      if (biz.phone) c = c + " (" + biz.phone + ")";
      noteBits.push("Contact: " + c);
    }

    const applicationDoc = {
      branchName,
      storeId,
      email: (biz.email || "").trim(),
      contactName: (biz.contactName || "").trim(),
      phone: biz.phone || null,
      location: biz.location || "",
      status: "pending" as const,
      submittedAt: serverTimestamp(),
      notes: noteBits.length ? noteBits.join(" | ") : null,
      inventoryData: mappedRows && mappedRows.length ? mappedRows : null,
      fileName: fileName || null,
    } as const;

    try {
      await toast.promise(
        addDoc(collection(db, "branchApplications"), applicationDoc),
        {
          loading: lang === "th" ? "กำลังส่งคำขอ..." : "Submitting application...",
          success: lang === "th" ? "ส่งคำขอแล้ว" : "Application submitted for approval",
          error: lang === "th" ? "ส่งคำขอล้มเหลว" : "Failed to submit",
        }
      );
      setStep(3);
    } finally { setSubmitting(false); }
  }

  /* ============================ Render ============================ */

  return (
    <div className="mx-auto max-w-5xl p-4 md:p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">{t("title")}</h1>
        <p className="text-muted-foreground">{t("subtitle")}</p>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Info className="h-3.5 w-3.5" /> {t("adminNote")}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-1">
          <Stepper lang={lang} setLang={setLang} progress={progress} t={t} step={step} />
        </div>
        <div className="md:col-span-2 space-y-4">
          {step === 0 && (
            <StepBusinessInfo
              t={t}
              lang={lang}
              biz={biz}
              setBiz={setBiz}
              bizValid={bizValid}
              onNext={() => setStep(1)}
              nameRef={nameRef}
            />
          )}

          {step === 1 && (
            <StepImport
              t={t}
              lang={lang}
              headers={headers}
              fileName={fileName}
              mapping={mapping as any}
              setMapping={(m) => setMapping(m as any)}
              treatEmptyPromoAsNull={treatEmptyPromoAsNull}
              setTreatEmptyPromoAsNull={(b) => setTreatEmptyPromoAsNull(Boolean(b))}
              allowEmptyDot={allowEmptyDot}
              setAllowEmptyDot={(b) => setAllowEmptyDot(Boolean(b))}
              mappedRows={mappedRows}
              mappingValid={mappingValid}
              bizValid={bizValid}
              rowsCount={rows.length}
              onChooseFile={handleChooseFile}
              csvInputRef={csvInputRef}
              onFileChange={(f) => {
                setFileName(f.name);
                parseCSV(f);
              }}
              onDropCSV={onDropCSV}
              onNext={() => setStep(2)}
              onPrev={prev}
              onClear={() => {
                setHeaders([]);
                setRows([]);
                setMapping({ sku: "", brand: "", model: "", size: "", loadIndex: "", dotCode: "", qty: "", basePrice: "", promoPrice: "" } as any);
                setFileName("");
              }}
              downloadTemplate={downloadTemplate}
            />
          )}

          {step === 2 && (
            <StepReview
              t={t}
              biz={biz}
              submitting={submitting}
              onPrev={prev}
              onSubmit={submitApplication}
            />
          )}

          {step === 3 && (
            <StepDone
              t={t}
              lang={lang}
              onDone={onDone}
              onImportMore={() => setStep(1)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
