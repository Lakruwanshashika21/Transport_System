import { useState, useEffect, useMemo } from 'react';
import { User as UserIcon, ArrowLeft, DollarSign, Calendar, Save, History, FileText, X, AlertTriangle, Download } from 'lucide-react';
import { User } from '../../App';
import { TopNav } from '../shared/TopNav';
import { Card } from '../shared/Card';
import { Badge } from '../shared/Badge';
// Firebase Imports
import { collection, getDocs, query, where, doc, setDoc, onSnapshot, orderBy } from 'firebase/firestore';
import { db } from '../../firebase';
import { logAction } from '../../utils/auditLogger';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

interface DriverPayrollManagementProps {
    user: User;
    onNavigate: (screen: string) => void;
    onLogout: () => void;
}

// Interface matching the required payroll/expense fields
interface PayrollData {
    salary: number;
    fuelAllowance: number;
    mobileAllowance: number;
    mealExpenses: number;
    otherExpenses: number;
    fineReimbursement: number; // Correct field name
}

const initialPayrollData: PayrollData = {
    salary: 0,
    fuelAllowance: 0,
    mobileAllowance: 0,
    mealExpenses: 0,
    otherExpenses: 0,
    fineReimbursement: 0, 
};

// Helper to format a date to 'YYYY-MM'
const formatMonth = (date: Date): string => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    return `${year}-${month}`;
};

// 🌟 NEW PDF HEADER HELPER 🌟
// Centralized function to add the company logo and report title
const applyReportHeader = (doc: jsPDF, reportName: string, subTitle?: string) => {
    // Image Path (Assuming 'report-header.jpg' is in the public folder)
    const imgData = 'report-header.jpg'; 
    const imgWidth = 50; // Set desired width for logo
    const imgHeight = 25; // Set desired height for logo
    const pageWidth = doc.internal.pageSize.getWidth();
    const marginX = 15;
    const centerOffset = (pageWidth - imgWidth) / 2; // Center the image

    // Add Logo (Centrally aligned)
    try {
        doc.addImage(imgData, 'JPEG', centerOffset, 5, imgWidth, imgHeight); 
    } catch (e) {
        // Fallback text if image fails to load/render
        doc.setFontSize(10);
        doc.setFont(undefined, 'bold');
        doc.text("Company Logo Placeholder", centerOffset, 15);
    }

    let y = 40; // Start main content below the header image/placeholder

    doc.setFontSize(22);
    doc.setFont(undefined, 'bold');
    doc.text(reportName, marginX, y);
    y += 8;
    
    if (subTitle) {
        doc.setFontSize(14);
        doc.setFont(undefined, 'normal');
        doc.text(subTitle, marginX, y);
        y += 6;
    }

    return y; // Return the new starting Y position for the content
}

export function DriverPayrollManagement({ user, onNavigate, onLogout }: DriverPayrollManagementProps) {
    const [drivers, setDrivers] = useState<any[]>([]);
    const [payrollHistory, setPayrollHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeDriver, setActiveDriver] = useState<any>(null);
    const [currentPeriod, setCurrentPeriod] = useState(formatMonth(new Date()));
    const [payrollData, setPayrollData] = useState<PayrollData>(initialPayrollData);
    const [statusMessage, setStatusMessage] = useState({ type: '', message: '' });

    // --- Data Fetching (Retained) ---
    useEffect(() => {
        setLoading(true);

        const unsubDrivers = onSnapshot(query(collection(db, "users"), where("role", "==", "driver")), (snap) => {
            const driversList = snap.docs.map(doc => ({ id: doc.id, name: doc.data().fullName || doc.data().name, ...doc.data() }));
            setDrivers(driversList);
            if (!activeDriver && driversList.length > 0) {
                setActiveDriver(driversList[0]);
            }
        });

        const unsubPayroll = onSnapshot(query(collection(db, "driver_payroll"), orderBy("period", "desc")), (snap) => {
            setPayrollHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
            setLoading(false);
        });

        return () => { unsubDrivers(); unsubPayroll(); };
    }, [activeDriver]);

    // --- Load Data for Selected Period/Driver (Fixed to load fineReimbursement) ---
    useEffect(() => {
        if (!activeDriver || !currentPeriod) return;

        const record = payrollHistory.find(p => p.driverId === activeDriver.id && p.period === currentPeriod);

        if (record) {
            setPayrollData({
                salary: record.salary || 0,
                fuelAllowance: record.fuelAllowance || 0,
                mobileAllowance: record.mobileAllowance || 0,
                mealExpenses: record.mealExpenses || 0,
                otherExpenses: record.otherExpenses || 0,
                fineReimbursement: record.fineReimbursement || 0, 
            });
            setStatusMessage({ type: 'info', message: 'Loaded existing record for this period.' });
        } else {
            setPayrollData(initialPayrollData);
            setStatusMessage({ type: 'success', message: 'Ready to enter new payroll data.' });
        }
    }, [activeDriver, currentPeriod, payrollHistory]);

    const handleChange = (name: keyof PayrollData, value: string) => {
        setPayrollData(prev => ({ ...prev, [name]: parseFloat(value) || 0 }));
    };
    
    // 🌟 FIX: Total Payout Calculation (Additive) 🌟
    const totalPayout = useMemo(() => {
        return (
            payrollData.salary + 
            payrollData.fuelAllowance + 
            payrollData.mobileAllowance + 
            payrollData.mealExpenses + 
            payrollData.otherExpenses +
            payrollData.fineReimbursement // ADDITIVE: Fine is a reimbursement/allowance
        );
    }, [payrollData]);


    const handleSavePayroll = async () => { /* ... (Logic retained) ... */
        if (!activeDriver || totalPayout === 0) {
            setStatusMessage({ type: 'error', message: 'Total payout is zero. Please enter values first.' });
            return;
        }

        const docId = `${activeDriver.id}-${currentPeriod}`;
        
        try {
            await setDoc(doc(db, "driver_payroll", docId), {
                driverId: activeDriver.id,
                driverName: activeDriver.name,
                period: currentPeriod,
                ...payrollData,
                totalPayout: totalPayout,
                savedBy: user.fullName || user.email,
                savedAt: new Date().toISOString(),
            }, { merge: true });

            await logAction(user.email, 'PAYROLL_SAVE', 
                `Saved payroll for ${activeDriver.name} (${currentPeriod}). Total: LKR ${totalPayout.toLocaleString()}`, 
                { driverId: activeDriver.id, period: currentPeriod }
            );

            setStatusMessage({ type: 'success', message: `Payroll saved successfully for ${currentPeriod}!` });
            
            // Force re-fetch of history to update the view
            const snap = await getDocs(query(collection(db, "driver_payroll"), orderBy("period", "desc")));
            setPayrollHistory(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));


        } catch (error) {
            console.error("Error saving payroll:", error);
            setStatusMessage({ type: 'error', message: 'Failed to save payroll. Check console.' });
        }
    };

    // 🌟 PDF GENERATION LOGIC (UPDATED FOR REIMBURSEMENT + HEADER) 🌟
    const handleDownloadPaysheet = (record: any) => {
        const doc = new jsPDF();
        
        const periodName = new Date(record.period).toLocaleString('en-US', { month: 'long', year: 'numeric' });
        
        // 🌟 Apply Report Header and get starting Y coordinate 🌟
        let y = applyReportHeader(doc, "Driver Monthly Paysheet", record.driverName);

        const marginX = 15;

        // Driver details
        doc.setFontSize(10);
        doc.setFont(undefined, 'normal');
        doc.text(`Period: ${periodName}`, marginX, y);
        y += 4;
        doc.text(`EPF/ID: ${activeDriver.epfNumber || record.driverId}`, marginX, y);
        y += 10;
        
        // Pay Breakdown Table (Allowances)
        const breakdownData = [
            // Earnings (Positive)
            ['1. Fixed Salary', `LKR ${record.salary.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Allowance'],
            ['2. Fuel Allowance', `LKR ${record.fuelAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Allowance'],
            ['3. Mobile Allowance', `LKR ${record.mobileAllowance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Allowance'],
            ['4. Meal Allowance/Expenses', `LKR ${record.mealExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Allowance'],
            ['5. Other Expenses/BOI', `LKR ${record.otherExpenses.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Allowance'],
            // FINE REIMBURSEMENT: TREATED AS POSITIVE EARNING
            ['6. Fine Claims Reimbursement', `LKR ${record.fineReimbursement.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 'Reimb.'],
        ];

        autoTable(doc, {
            startY: y,
            head: [['Description', 'Amount', 'Type']],
            body: breakdownData,
            theme: 'grid',
            headStyles: { fillColor: [40, 167, 69] }, 
            styles: { fontSize: 10, cellPadding: 3 },
            columnStyles: { 
                1: { fontStyle: 'bold', halign: 'right' },
                2: { cellWidth: 20, halign: 'center' }
            },
        });

        y = (doc as any).lastAutoTable.finalY + 15;
        
        // Total Payout
        doc.setFontSize(16);
        doc.setFont(undefined, 'bold');
        doc.text("NET PAYOUT:", marginX, y);
        doc.text(`LKR ${record.totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, 195, y, { align: 'right' });
        y += 20;

        // Footer / Signature
        doc.setFontSize(8);
        doc.setFont(undefined, 'italic');
        doc.text(`Generated by: ${user.fullName || user.email} on ${new Date().toLocaleDateString()}`, marginX, y);
        y += 15;
        
        doc.setFont(undefined, 'bold');
        doc.line(marginX, y, marginX + 50, y);
        doc.text("Authorized Signature", marginX, y + 5);

        doc.save(`Paysheet_${record.driverName.replace(/\s/g, '_')}_${record.period}.pdf`);
    };
    // 🌟 END PDF GENERATION LOGIC 🌟


    const driverHistoryFiltered = payrollHistory.filter(p => p.driverId === activeDriver?.id);

    // Check if the current period/driver combination has a saved record for PDF generation
    const isCurrentPeriodSaved = payrollHistory.some(p => p.driverId === activeDriver?.id && p.period === currentPeriod);

    return (
        <div className="min-h-screen bg-[#F9FAFB]">
            <TopNav user={user} onNavigate={onNavigate} onLogout={onLogout} currentScreen="payroll-management" />
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
                
                <div className="flex justify-between items-center mb-8">
                    <div>
                        <button onClick={() => onNavigate('admin-dashboard')} className="mb-2 text-gray-500 hover:text-gray-900 flex items-center gap-1 transition-colors"><ArrowLeft className="w-4 h-4"/> Back to Dashboard</button>
                        <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2"><DollarSign className="w-7 h-7 text-green-600"/> Driver Payroll & Allowances</h1>
                        <p className="text-gray-600 text-sm">Manage and record monthly pay, fuel, mobile, and meal allowances.</p>
                    </div>
                </div>
                
                {statusMessage.message && (
                    <div className={`mb-6 p-3 rounded-xl border flex items-center gap-2 ${
                        statusMessage.type === 'error' ? 'bg-red-50 border-red-200 text-red-800' : 'bg-green-50 border-green-200 text-green-800'
                    }`}>
                        <AlertTriangle className="w-5 h-5"/> {statusMessage.message}
                    </div>
                )}

                {/* --- SELECTION CARDS --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                    
                    <Card className="p-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><UserIcon className="w-4 h-4"/> Select Driver</label>
                        <select 
                            className="w-full p-2 border border-gray-300 rounded-xl"
                            value={activeDriver?.id || ''}
                            onChange={(e) => setActiveDriver(drivers.find(d => d.id === e.target.value))}
                            disabled={loading}
                        >
                            {loading && <option>Loading...</option>}
                            {drivers.map(d => (
                                <option key={d.id} value={d.id}>{d.name} ({d.epfNumber || d.email})</option>
                            ))}
                        </select>
                    </Card>

                    <Card className="p-4">
                        <label className="block text-sm font-bold text-gray-700 mb-2 flex items-center gap-2"><Calendar className="w-4 h-4"/> Select Period (Month/Year)</label>
                        <input 
                            type="month" 
                            className="w-full p-2 border border-gray-300 rounded-xl"
                            value={currentPeriod}
                            onChange={(e) => setCurrentPeriod(e.target.value)}
                        />
                    </Card>

                    {/* TOTAL PAYOUT & CURRENT PERIOD PDF BUTTON */}
                    <Card className="p-4 bg-blue-50 border-blue-200 flex flex-col justify-center">
                        <div className="mb-3">
                            <div className="text-sm text-blue-700">Net Payout for Current Entry</div>
                            <div className="text-3xl font-extrabold text-blue-900">
                                {totalPayout.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </div>
                        </div>
                        {isCurrentPeriodSaved && (
                            <button 
                                onClick={() => handleDownloadPaysheet(payrollHistory.find(p => p.driverId === activeDriver?.id && p.period === currentPeriod))} 
                                className="bg-green-600 text-white w-full py-2 rounded-xl font-medium hover:bg-green-700 flex items-center justify-center gap-2 shadow-md"
                            >
                                <Download className="w-5 h-5"/> Download Paysheet (Saved)
                            </button>
                        )}
                    </Card>
                </div>

                {/* --- PAYROLL ENTRY & HISTORY --- */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* PAYROLL ENTRY FORM (COLUMN 1) */}
                    <div className="lg:col-span-1">
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4 text-gray-800">Allowance Entry</h2>
                            <div className="space-y-4">
                                
                                {/* Fixed Allowances */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">1. Salary (Fixed)</label>
                                    <input type="number" name="salary" value={payrollData.salary} onChange={e => handleChange('salary', e.target.value)} className="w-full p-3 border rounded-xl" placeholder="LKR 0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">2. Fuel Allowance</label>
                                    <input type="number" name="fuelAllowance" value={payrollData.fuelAllowance} onChange={e => handleChange('fuelAllowance', e.target.value)} className="w-full p-3 border rounded-xl" placeholder="LKR 0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">3. Mobile Allowance</label>
                                    <input type="number" name="mobileAllowance" value={payrollData.mobileAllowance} onChange={e => handleChange('mobileAllowance', e.target.value)} className="w-full p-3 border rounded-xl" placeholder="LKR 0.00" />
                                </div>
                                
                                {/* Variable Expenses */}
                                <div className="pt-2 border-t">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">4. Meal Allowance/Expenses</label>
                                    <input type="number" name="mealExpenses" value={payrollData.mealExpenses} onChange={e => handleChange('mealExpenses', e.target.value)} className="w-full p-3 border rounded-xl" placeholder="LKR 0.00" />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">5. Other Expenses/BOI/Extra</label>
                                    <input type="number" name="otherExpenses" value={payrollData.otherExpenses} onChange={e => handleChange('otherExpenses', e.target.value)} className="w-full p-3 border rounded-xl" placeholder="LKR 0.00" />
                                </div>
                                
                                {/* 🌟 FINE REIMBURSEMENT FIELD (READ-ONLY) 🌟 */}
                                <div className="pt-2 border-t">
                                    <label className="block text-sm font-medium text-green-700 mb-1 flex items-center">
                                        <DollarSign className="w-4 h-4 mr-1"/> 6. Fine Claims Reimbursement
                                    </label>
                                    <input 
                                        type="number" 
                                        name="fineReimbursement" 
                                        value={payrollData.fineReimbursement} 
                                        readOnly 
                                        className="w-full p-3 border rounded-xl bg-green-50 font-bold text-green-800" 
                                        placeholder="LKR 0.00" 
                                    />
                                    <p className="text-xs text-green-600 mt-1">This amount is automatically pulled from **settled claims** and added to pay.</p>
                                </div>

                                {/* 🌟 PRIMARY ACTION SAVE BUTTON (FIX) 🌟 */}
                                <div className="pt-4 mt-4 border-t">
                                    <button onClick={handleSavePayroll} className="bg-blue-600 text-white w-full py-3 rounded-xl font-medium hover:bg-blue-700 flex items-center justify-center gap-2 shadow-md">
                                        <Save className="w-5 h-5"/> Save Current Period Data
                                    </button>
                                </div>
                                {/* 🌟 END FIX 🌟 */}
                            </div>
                        </Card>
                    </div>

                    {/* HISTORY LIST (COLUMN 2/3) */}
                    <div className="lg:col-span-2">
                        <Card className="p-6">
                            <h2 className="text-xl font-bold mb-4 text-gray-800 flex items-center gap-2"><History className="w-5 h-5"/> Payment History for {activeDriver?.name || 'Selected Driver'}</h2>
                            
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Period</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Salary</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Reimb.</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Net Pay</th>
                                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {driverHistoryFiltered.length === 0 ? (
                                            <tr><td colSpan={5} className="py-4 text-center text-gray-500">No records found for this driver.</td></tr>
                                        ) : (
                                            driverHistoryFiltered.map(p => (
                                                <tr key={p.id} className={`hover:bg-gray-50 cursor-pointer ${p.period === currentPeriod ? 'bg-blue-50 border-blue-400' : ''}`} onClick={() => setCurrentPeriod(p.period)}>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-medium text-gray-900">{p.period}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm text-gray-700">LKR {p.salary?.toLocaleString() || '0'}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-green-600">LKR {p.fineReimbursement?.toLocaleString() || '0'}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-sm font-bold text-green-600">LKR {p.totalPayout?.toLocaleString() || '0'}</td>
                                                    <td className="px-3 py-2 whitespace-nowrap text-right">
                                                        <button 
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDownloadPaysheet(p);
                                                            }}
                                                            className="text-gray-600 hover:text-blue-600 p-1 rounded-full bg-white border"
                                                            title="Download Paysheet"
                                                        >
                                                            <FileText className="w-4 h-4"/>
                                                        </button>
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </Card>
                    </div>
                </div>
            </div>
        </div>
    );
}

// Minimal Badge definition needed if not imported globally
const Badge = ({ status, size }: { status: string, size?: string }) => {
    let classes = 'inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium';
    if (status === 'available') classes += ' bg-green-100 text-green-800';
    else if (status === 'in-use') classes += ' bg-yellow-100 text-yellow-800';
    else classes += ' bg-gray-100 text-gray-800';
    return <span className={classes}>{status.toUpperCase().replace('-', ' ')}</span>;
};