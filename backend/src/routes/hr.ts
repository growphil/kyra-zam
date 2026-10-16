import { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { prisma } from "../prisma";
import { requireRoles } from "../middleware/rbac";

// Official Zambia 2026 Public Holidays (Statutory - Zambia Public Holidays Act)
const OFFICIAL_ZAMBIA_HOLIDAYS_2026 = [
  { name: "New Year's Day", date: "2026-01-01", isStatutory: true, description: "New Year's Day" },
  { name: "International Women's Day", date: "2026-03-08", isStatutory: true, description: "International Women's Day" },
  { name: "Youth Day", date: "2026-03-12", isStatutory: true, description: "National Youth Day" },
  { name: "Good Friday", date: "2026-04-03", isStatutory: true, isMovable: true, description: "Christian Good Friday" },
  { name: "Holy Saturday", date: "2026-04-04", isStatutory: true, isMovable: true, description: "Easter Saturday" },
  { name: "Easter Monday", date: "2026-04-06", isStatutory: true, isMovable: true, description: "Easter Monday" },
  { name: "Labour Day", date: "2026-05-01", isStatutory: true, description: "International Workers' Day" },
  { name: "Africa Freedom Day", date: "2026-05-25", isStatutory: true, description: "Africa Day celebration" },
  { name: "Heroes' Day", date: "2026-07-06", isStatutory: true, isMovable: true, description: "First Monday of July" },
  { name: "Unity Day", date: "2026-07-07", isStatutory: true, isMovable: true, description: "Tuesday following Heroes' Day" },
  { name: "Farmers' Day", date: "2026-08-03", isStatutory: true, isMovable: true, description: "First Monday of August" },
  { name: "National Prayer Day", date: "2026-10-18", isStatutory: true, description: "National Day of Prayer and Reconciliation" },
  { name: "Independence Day", date: "2026-10-24", isStatutory: true, description: "Zambia National Independence Day (1964)" },
  { name: "Christmas Day", date: "2026-12-25", isStatutory: true, description: "Christmas Day celebration" }
];

// Official Statutory Zambia Leave Entitlements (Employment Code Act No. 3 of 2019)
const DEFAULT_ZAMBIA_LEAVE_POLICIES = [
  {
    code: "ANNUAL",
    name: "Annual Leave",
    daysPerYear: 24, // 2 days per month worked = 24 days per year
    isPaid: true,
    carryOverMax: 12,
    requiresDoc: false,
    description: "Statutory annual vacation under Zambia Employment Code Act (2 days/month)"
  },
  {
    code: "SICK",
    name: "Sick Leave",
    daysPerYear: 54, // 26 days full pay + 28 days half pay
    isPaid: true,
    carryOverMax: 0,
    requiresDoc: true,
    description: "Medical sick leave supported by certified medical practitioner report"
  },
  {
    code: "MATERNITY",
    name: "Maternity Leave",
    daysPerYear: 98, // 14 weeks continuous
    isPaid: true,
    carryOverMax: 0,
    requiresDoc: true,
    description: "14 weeks statutory maternity leave for female employees"
  },
  {
    code: "PATERNITY",
    name: "Paternity Leave",
    daysPerYear: 5, // 5 continuous working days
    isPaid: true,
    carryOverMax: 0,
    requiresDoc: true,
    description: "Statutory paternity leave to be taken within 7 days of birth"
  },
  {
    code: "COMPASSIONATE",
    name: "Compassionate / Bereavement Leave",
    daysPerYear: 7,
    isPaid: true,
    carryOverMax: 0,
    requiresDoc: false,
    description: "Leave granted for demise of immediate family member"
  }
];

// Official Zambia Statutory Tax & Contribution Rules (ZRA & NAPSA & NHIMA 2026 Baseline)
// Band 1: 0 - 5,100 ZMW @ 0%
// Band 2: 5,100.01 - 7,100 ZMW @ 20%
// Band 3: 7,100.01 - 9,200 ZMW @ 30%
// Band 4: > 9,200 ZMW @ 37%
// NAPSA: 5% employee, 5% employer up to monthly ceiling (e.g. 30,368 ZMW wage ceiling -> max 1,518.40)
// NHIMA: 1% employee, 1% employer on basic salary
const DEFAULT_ZAMBIA_STATUTORY_RULESET = {
  versionName: "ZAM-2026-STATUTORY-V1",
  country: "Zambia",
  currency: "ZMW",
  effectiveFrom: new Date("2026-01-01T00:00:00.000Z"),
  isActive: true,
  notes: "Official 2026 Zambia Revenue Authority (ZRA) PAYE bands, NAPSA 5% and NHIMA 1%",
  payeBands: [
    { min: 0, max: 5100, rate: 0.0 },
    { min: 5100, max: 7100, rate: 0.20 },
    { min: 7100, max: 9200, rate: 0.30 },
    { min: 9200, max: null, rate: 0.37 }
  ],
  napsaEmployeeRate: 0.05,
  napsaEmployerRate: 0.05,
  napsaCeiling: 30368.0,
  nhimaEmployeeRate: 0.01,
  nhimaEmployerRate: 0.01
};

export async function hrRoutes(app: FastifyInstance) {
  // Authorization helper
  const authMiddleware = requireRoles("HR_PAYROLL", "ADMIN", "SUPERADMIN", "ACCOUNTANT");

  // =========================================================================
  // SEED / BOOTSTRAP DEFAULTS
  // =========================================================================
  app.post("/bootstrap-defaults", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).user;

      // 1. Seed Holidays
      let createdHolidays = 0;
      for (const h of OFFICIAL_ZAMBIA_HOLIDAYS_2026) {
        const d = new Date(h.date);
        const existing = await prisma.workCalendarHoliday.findFirst({
          where: { name: h.name, year: 2026 }
        });
        if (!existing) {
          await prisma.workCalendarHoliday.create({
            data: {
              name: h.name,
              date: d,
              year: 2026,
              isStatutory: h.isStatutory,
              isMovable: h.isMovable || false,
              description: h.description
            }
          });
          createdHolidays++;
        }
      }

      // 2. Seed Leave Policies
      let createdPolicies = 0;
      for (const p of DEFAULT_ZAMBIA_LEAVE_POLICIES) {
        const existing = await prisma.leavePolicy.findUnique({
          where: { code: p.code }
        });
        if (!existing) {
          await prisma.leavePolicy.create({
            data: p
          });
          createdPolicies++;
        }
      }

      // 3. Seed Default Shifts (Factory Morning, Factory Afternoon, Office General)
      const defaultShifts = [
        { code: "SH-FACT-AM", name: "Factory Day Shift", startTime: "07:00", endTime: "15:30", breakMinutes: 30, graceMinutes: 15, workDays: [1, 2, 3, 4, 5, 6], isFactoryShift: true },
        { code: "SH-FACT-PM", name: "Factory Evening Shift", startTime: "15:30", endTime: "23:00", breakMinutes: 30, graceMinutes: 15, workDays: [1, 2, 3, 4, 5, 6], isFactoryShift: true },
        { code: "SH-OFF-GEN", name: "Corporate / Office General", startTime: "08:00", endTime: "17:00", breakMinutes: 60, graceMinutes: 15, workDays: [1, 2, 3, 4, 5], isFactoryShift: false }
      ];
      let createdShifts = 0;
      for (const s of defaultShifts) {
        const existing = await prisma.workShift.findUnique({ where: { code: s.code } });
        if (!existing) {
          await prisma.workShift.create({ data: s });
          createdShifts++;
        }
      }

      // 4. Seed Statutory Rule Set if none exists
      let createdRule = false;
      const existingRule = await prisma.statutoryRuleSet.findUnique({
        where: { versionName: DEFAULT_ZAMBIA_STATUTORY_RULESET.versionName }
      });
      if (!existingRule) {
        await prisma.statutoryRuleSet.create({
          data: {
            ...DEFAULT_ZAMBIA_STATUTORY_RULESET,
            createdById: user?.id
          }
        });
        createdRule = true;
      }

      return reply.send({
        success: true,
        message: "Zambia statutory defaults initialized successfully.",
        created: { createdHolidays, createdPolicies, createdShifts, createdRule }
      });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to initialize defaults", details: err.message });
    }
  });

  // =========================================================================
  // HR DASHBOARD METRICS
  // =========================================================================
  app.get("/dashboard", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const now = new Date();
      // Africa/Lusaka is UTC+2
      const todayStr = now.toISOString().split("T")[0];
      const startOfToday = new Date(`${todayStr}T00:00:00.000Z`);
      const endOfToday = new Date(`${todayStr}T23:59:59.999Z`);

      // 1. Total & Active employees
      const activeEmployeesCount = await prisma.employee.count({
        where: { employmentStatus: "ACTIVE" }
      });
      const totalEmployeesCount = await prisma.employee.count();

      // 2. Today's attendance counts
      const todayAttendances = await prisma.attendance.findMany({
        where: {
          workDate: {
            gte: startOfToday,
            lte: endOfToday
          }
        }
      });

      let presentCount = 0;
      let lateCount = 0;
      let clockedInCount = 0;
      let missingClockOutCount = 0;

      for (const att of todayAttendances) {
        if (att.clockIn) {
          presentCount++;
          if (att.lateMinutes > 0) lateCount++;
          if (!att.clockOut) {
            clockedInCount++;
            // If clockIn was more than 10 hours ago and still no clockOut, mark exception
            const hoursSincePunch = (now.getTime() - new Date(att.clockIn).getTime()) / (1000 * 3600);
            if (hoursSincePunch > 10) missingClockOutCount++;
          }
        }
      }

      // 3. Pending approvals
      const pendingLeaveCount = await prisma.leaveRequest.count({
        where: { status: "PENDING" }
      });
      const pendingCorrectionsCount = await prisma.attendanceCorrection.count({
        where: { status: "PENDING" }
      });

      // 4. Current Payroll Period
      const activePayrollPeriod = await prisma.payrollPeriod.findFirst({
        orderBy: { startDate: "desc" },
        include: {
          _count: { select: { records: true } }
        }
      });

      // 5. Upcoming Public Holidays (next 45 days)
      const upcomingHolidays = await prisma.workCalendarHoliday.findMany({
        where: {
          date: {
            gte: startOfToday
          }
        },
        orderBy: { date: "asc" },
        take: 5
      });

      // 6. Recent clock events
      const recentAttendance = await prisma.attendance.findMany({
        take: 8,
        orderBy: { updatedAt: "desc" },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: true }
          },
          shift: {
            select: { name: true, startTime: true, endTime: true }
          }
        }
      });

      return reply.send({
        activeEmployeesCount,
        totalEmployeesCount,
        presentCount,
        lateCount,
        clockedInCount,
        missingClockOutCount,
        pendingLeaveCount,
        pendingCorrectionsCount,
        activePayrollPeriod,
        upcomingHolidays,
        recentAttendance
      });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to load HR dashboard", details: err.message });
    }
  });

  // =========================================================================
  // EMPLOYEES CRUD
  // =========================================================================
  app.get("/employees", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { search, department, status, designation } = req.query as any;

      const where: any = {};
      if (status && status !== "ALL") {
        if (status === "INACTIVE") {
          where.employmentStatus = { in: ["SUSPENDED", "TERMINATED", "RESIGNED"] };
        } else {
          where.employmentStatus = status;
        }
      }
      if (department && department !== "ALL") where.department = department;
      if (designation && designation !== "ALL") where.designation = designation;

      if (search) {
        where.OR = [
          { employeeNumber: { contains: search, mode: "insensitive" } },
          { firstName: { contains: search, mode: "insensitive" } },
          { lastName: { contains: search, mode: "insensitive" } },
          { email: { contains: search, mode: "insensitive" } },
          { nrcNumber: { contains: search, mode: "insensitive" } }
        ];
      }

      const employees = await prisma.employee.findMany({
        where,
        orderBy: { employeeNumber: "asc" },
        include: {
          shift: { select: { id: true, name: true, code: true, startTime: true, endTime: true } },
          manager: { select: { id: true, employeeNumber: true, firstName: true, lastName: true } },
          user: { select: { id: true, email: true, roles: true } }
        }
      });

      return reply.send({ employees });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch employees", details: err.message });
    }
  });

  app.get("/employees/:id", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const currentYear = new Date().getFullYear();

      const employee = await prisma.employee.findUnique({
        where: { id },
        include: {
          shift: true,
          manager: true,
          subordinates: { select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: true } },
          user: { select: { id: true, email: true, roles: true } },
          leaveBalances: {
            where: { year: currentYear },
            include: { policy: true }
          },
          attendances: {
            take: 10,
            orderBy: { workDate: "desc" },
            include: { shift: true }
          },
          payrollRecords: {
            take: 6,
            orderBy: { period: { startDate: "desc" } },
            include: { period: true }
          }
        }
      });

      if (!employee) {
        return reply.status(404).send({ error: "Employee not found" });
      }

      return reply.send({ employee });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch employee", details: err.message });
    }
  });

  app.post("/employees", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const data = req.body as any;

      // Auto-generate employee number if not provided
      let empNum = data.employeeNumber;
      if (!empNum) {
        const count = await prisma.employee.count();
        empNum = `KZ-${String(count + 1).padStart(4, "0")}`;
      }

      // Check unique
      const existing = await prisma.employee.findUnique({ where: { employeeNumber: empNum } });
      if (existing) {
        return reply.status(400).send({ error: `Employee number ${empNum} already exists` });
      }

      // Create employee
      const employee = await prisma.employee.create({
        data: {
          employeeNumber: empNum,
          firstName: data.firstName,
          lastName: data.lastName,
          email: data.email || null,
          phone: data.phone || null,
          nrcNumber: data.nrcNumber || null,
          tpinNumber: data.tpinNumber || null,
          napsaNumber: data.napsaNumber || null,
          nhimaNumber: data.nhimaNumber || null,
          department: data.department || "Manufacturing",
          designation: data.designation || "Factory Associate",
          employmentStatus: data.employmentStatus || "ACTIVE",
          employmentType: data.employmentType || "FULL_TIME",
          hireDate: data.hireDate ? new Date(data.hireDate) : new Date(),
          managerId: data.managerId || null,
          workLocation: data.workLocation || "Lusaka Battery Plant",
          shiftId: data.shiftId || null,
          salaryBasis: data.salaryBasis || "MONTHLY",
          baseSalary: parseFloat(data.baseSalary) || 0,
          currency: data.currency || "ZMW",
          bankName: data.bankName || null,
          bankBranch: data.bankBranch || null,
          bankAccountNumber: data.bankAccountNumber || null,
          mobileMoneyProvider: data.mobileMoneyProvider || null,
          mobileMoneyNumber: data.mobileMoneyNumber || null,
          userId: data.userId || null
        }
      });

      // Auto-initialize current year leave balances from active leave policies
      const currentYear = new Date().getFullYear();
      const policies = await prisma.leavePolicy.findMany();
      for (const policy of policies) {
        await prisma.leaveBalance.create({
          data: {
            employeeId: employee.id,
            policyId: policy.id,
            year: currentYear,
            entitledDays: policy.daysPerYear,
            usedDays: 0,
            pendingDays: 0,
            remainingDays: policy.daysPerYear
          }
        });
      }

      return reply.status(201).send({ employee, message: "Employee registered successfully" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to create employee", details: err.message });
    }
  });

  app.patch("/employees/:id", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const data = req.body as any;

      const updateData: any = { ...data };
      if (updateData.baseSalary !== undefined) updateData.baseSalary = parseFloat(updateData.baseSalary) || 0;
      if (updateData.hireDate) updateData.hireDate = new Date(updateData.hireDate);
      if (updateData.terminationDate) updateData.terminationDate = new Date(updateData.terminationDate);

      // Prevent changing immutable relations directly
      delete updateData.id;
      delete updateData.createdAt;
      delete updateData.updatedAt;

      const updated = await prisma.employee.update({
        where: { id },
        data: updateData,
        include: { shift: true }
      });

      return reply.send({ employee: updated, message: "Employee record updated" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to update employee", details: err.message });
    }
  });

  // Toggle Employee Status (Active <-> Inactive / Suspended / Terminated)
  app.patch("/employees/:id/toggle-status", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { status } = req.body as { status?: string };

      const existing = await prisma.employee.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Employee not found" });
      }

      const newStatus = status || (existing.employmentStatus === "ACTIVE" ? "SUSPENDED" : "ACTIVE");

      const updated = await prisma.employee.update({
        where: { id },
        data: {
          employmentStatus: newStatus as any,
          terminationDate: (newStatus === "TERMINATED" || newStatus === "SUSPENDED") ? new Date() : null
        },
        include: { shift: true }
      });

      return reply.send({
        success: true,
        employee: updated,
        message: `Employee marked as ${newStatus}`
      });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to update employee status", details: err.message });
    }
  });

  // Delete Employee (with cascade cleanup of attendance, corrections, leave, payroll records)
  app.delete("/employees/:id", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };

      const existing = await prisma.employee.findUnique({ where: { id } });
      if (!existing) {
        return reply.status(404).send({ error: "Employee not found" });
      }

      await prisma.$transaction(async (tx) => {
        // Unlink subordinates
        await tx.employee.updateMany({
          where: { managerId: id },
          data: { managerId: null }
        });
        // Delete leave requests & balances
        await tx.leaveRequest.deleteMany({ where: { employeeId: id } });
        await tx.leaveBalance.deleteMany({ where: { employeeId: id } });
        // Delete attendance corrections & attendance
        await tx.attendanceCorrection.deleteMany({ where: { employeeId: id } });
        await tx.attendance.deleteMany({ where: { employeeId: id } });
        // Delete payroll records
        await tx.employeePayrollRecord.deleteMany({ where: { employeeId: id } });
        // Delete employee record
        await tx.employee.delete({ where: { id } });
      });

      return reply.send({
        success: true,
        message: `Employee ${existing.firstName} ${existing.lastName} (${existing.employeeNumber}) deleted successfully`
      });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to delete employee", details: err.message });
    }
  });

  // =========================================================================
  // SHIFTS & WORKING CALENDAR
  // =========================================================================
  app.get("/shifts", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const shifts = await prisma.workShift.findMany({
        orderBy: { startTime: "asc" },
        include: {
          _count: { select: { employees: true } }
        }
      });
      return reply.send({ shifts });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch shifts", details: err.message });
    }
  });

  app.post("/shifts", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, code, startTime, endTime, breakMinutes, graceMinutes, workDays, isFactoryShift } = req.body as any;
      const shift = await prisma.workShift.create({
        data: {
          name,
          code,
          startTime,
          endTime,
          breakMinutes: parseInt(breakMinutes) || 30,
          graceMinutes: parseInt(graceMinutes) || 15,
          workDays: Array.isArray(workDays) ? workDays : [1, 2, 3, 4, 5],
          isFactoryShift: isFactoryShift ?? true
        }
      });
      return reply.status(201).send({ shift });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to create shift", details: err.message });
    }
  });

  app.get("/calendar/holidays", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { year } = req.query as any;
      const targetYear = year ? parseInt(year) : new Date().getFullYear();

      const holidays = await prisma.workCalendarHoliday.findMany({
        where: { year: targetYear },
        orderBy: { date: "asc" }
      });

      return reply.send({ holidays, year: targetYear });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch calendar holidays", details: err.message });
    }
  });

  app.post("/calendar/holidays", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { name, date, isStatutory, isMovable, description, isCompanyShutdown, applicableDepartment } = req.body as any;
      const d = new Date(date);
      const holiday = await prisma.workCalendarHoliday.create({
        data: {
          name,
          date: d,
          year: d.getFullYear(),
          isStatutory: isStatutory ?? false,
          isMovable: isMovable ?? false,
          description,
          isCompanyShutdown: isCompanyShutdown ?? false,
          applicableDepartment: applicableDepartment || null
        }
      });
      return reply.status(201).send({ holiday });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to create holiday", details: err.message });
    }
  });

  app.delete("/calendar/holidays/:id", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      await prisma.workCalendarHoliday.delete({ where: { id } });
      return reply.send({ success: true, message: "Holiday removed" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to delete holiday", details: err.message });
    }
  });

  // =========================================================================
  // ATTENDANCE & TIMESHEETS
  // =========================================================================
  app.get("/attendance", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { date, startDate, endDate, employeeId, department, status } = req.query as any;

      const where: any = {};
      if (employeeId && employeeId !== "ALL") where.employeeId = employeeId;
      if (status && status !== "ALL") where.status = status;
      if (department && department !== "ALL") {
        where.employee = { department };
      }

      if (date) {
        const start = new Date(`${date}T00:00:00.000Z`);
        const end = new Date(`${date}T23:59:59.999Z`);
        where.workDate = { gte: start, lte: end };
      } else if (startDate && endDate) {
        where.workDate = {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${endDate}T23:59:59.999Z`)
        };
      }

      const attendances = await prisma.attendance.findMany({
        where,
        orderBy: [{ workDate: "desc" }, { createdAt: "desc" }],
        include: {
          employee: {
            select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: true, designation: true }
          },
          shift: {
            select: { id: true, name: true, startTime: true, endTime: true, graceMinutes: true }
          },
          corrections: {
            take: 1,
            orderBy: { createdAt: "desc" }
          }
        }
      });

      return reply.send({ attendances });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch attendance records", details: err.message });
    }
  });

  // Clock In / Clock Out API
  app.post("/attendance/clock", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId, type, timestamp, notes } = req.body as {
        employeeId: string;
        type: "IN" | "OUT";
        timestamp?: string;
        notes?: string;
      };

      const eventTime = timestamp ? new Date(timestamp) : new Date();
      const dateStr = eventTime.toISOString().split("T")[0];
      const workDate = new Date(`${dateStr}T00:00:00.000Z`);

      // 1. Find employee and assigned shift
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId },
        include: { shift: true }
      });
      if (!employee) {
        return reply.status(404).send({ error: "Employee not found" });
      }

      const shift = employee.shift;

      // 2. Find or create today's attendance record
      let attendance = await prisma.attendance.findUnique({
        where: {
          employeeId_workDate: {
            employeeId,
            workDate
          }
        }
      });

      if (type === "IN") {
        if (attendance?.clockIn) {
          return reply.status(400).send({
            error: "Duplicate punch: Employee has already clocked in for this work date",
            attendance
          });
        }

        // Calculate late minutes if shift is defined
        let lateMinutes = 0;
        let status: any = "PRESENT";

        if (shift && shift.startTime) {
          const [sH, sM] = shift.startTime.split(":").map(Number);
          // Compare with clockIn local time in Lusaka (+02:00)
          // For calculation, parse shift time on workDate
          const shiftStartUtc = new Date(workDate);
          // Zambia is UTC+2
          shiftStartUtc.setUTCHours(sH - 2, sM, 0, 0);

          const diffMinutes = Math.floor((eventTime.getTime() - shiftStartUtc.getTime()) / (1000 * 60));
          if (diffMinutes > (shift.graceMinutes || 15)) {
            lateMinutes = diffMinutes;
            status = "LATE";
          }
        }

        attendance = await prisma.attendance.upsert({
          where: {
            employeeId_workDate: { employeeId, workDate }
          },
          create: {
            employeeId,
            workDate,
            shiftId: shift?.id || null,
            clockIn: eventTime,
            status,
            lateMinutes,
            notes
          },
          update: {
            clockIn: eventTime,
            status,
            lateMinutes,
            shiftId: shift?.id || null,
            notes
          }
        });

        return reply.send({
          success: true,
          message: `Clocked IN successfully at ${eventTime.toLocaleTimeString()}`,
          attendance
        });
      } else {
        // Clock OUT
        if (!attendance || !attendance.clockIn) {
          // Missing punch exception!
          attendance = await prisma.attendance.upsert({
            where: {
              employeeId_workDate: { employeeId, workDate }
            },
            create: {
              employeeId,
              workDate,
              shiftId: shift?.id || null,
              clockOut: eventTime,
              isMissingPunch: true,
              notes: "Missing clock-in punch record"
            },
            update: {
              clockOut: eventTime,
              isMissingPunch: true
            }
          });

          return reply.status(200).send({
            warning: "Recorded clock-out without prior clock-in. Marked as missing punch exception.",
            attendance
          });
        }

        if (attendance.clockOut) {
          return reply.status(400).send({
            error: "Employee has already clocked out for this work date",
            attendance
          });
        }

        // Calculate worked hours and overtime
        const clockInTime = new Date(attendance.clockIn);
        const durationHours = Math.max(0, (eventTime.getTime() - clockInTime.getTime()) / (1000 * 3600));

        let regularHours = Math.min(8.0, durationHours);
        let overtimeHours = 0;
        if (durationHours > 8.0) {
          overtimeHours = parseFloat((durationHours - 8.0).toFixed(2));
        }

        attendance = await prisma.attendance.update({
          where: { id: attendance.id },
          data: {
            clockOut: eventTime,
            workedHours: parseFloat(durationHours.toFixed(2)),
            regularHours: parseFloat(regularHours.toFixed(2)),
            overtimeHours,
            isMissingPunch: false,
            notes: notes || attendance.notes
          }
        });

        return reply.send({
          success: true,
          message: `Clocked OUT successfully. Worked: ${durationHours.toFixed(2)}h (Overtime: ${overtimeHours}h)`,
          attendance
        });
      }
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to process clock punch", details: err.message });
    }
  });

  // Attendance Corrections
  app.post("/attendance/corrections", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { attendanceId, requestedClockIn, requestedClockOut, reason } = req.body as any;
      if (!attendanceId || !reason) {
        return reply.status(400).send({ error: "attendanceId and reason are required" });
      }

      const att = await prisma.attendance.findUnique({ where: { id: attendanceId } });
      if (!att) return reply.status(404).send({ error: "Attendance record not found" });

      const correction = await prisma.attendanceCorrection.create({
        data: {
          attendanceId,
          employeeId: att.employeeId,
          requestedClockIn: requestedClockIn ? new Date(requestedClockIn) : null,
          requestedClockOut: requestedClockOut ? new Date(requestedClockOut) : null,
          reason,
          status: "PENDING"
        }
      });

      return reply.status(201).send({ correction, message: "Correction request submitted for approval" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to submit correction", details: err.message });
    }
  });

  app.get("/attendance/corrections", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status } = req.query as any;
      const where: any = {};
      if (status && status !== "ALL") where.status = status;

      const corrections = await prisma.attendanceCorrection.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: true }
          },
          attendance: true,
          decidedBy: { select: { id: true, name: true } }
        }
      });

      return reply.send({ corrections });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to list corrections", details: err.message });
    }
  });

  app.patch("/attendance/corrections/:id/decide", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { decision, note } = req.body as { decision: "APPROVED" | "REJECTED"; note?: string };
      const user = (req as any).user;

      const correction = await prisma.attendanceCorrection.findUnique({
        where: { id },
        include: { attendance: true }
      });
      if (!correction) return reply.status(404).send({ error: "Correction not found" });

      if (correction.status !== "PENDING") {
        return reply.status(400).send({ error: `Correction has already been ${correction.status}` });
      }

      await prisma.$transaction(async (tx) => {
        // 1. Update correction record
        await tx.attendanceCorrection.update({
          where: { id },
          data: {
            status: decision,
            decidedById: user?.id,
            decisionNote: note || null,
            decidedAt: new Date()
          }
        });

        // 2. If approved, apply to original attendance
        if (decision === "APPROVED") {
          const newClockIn = correction.requestedClockIn || correction.attendance.clockIn;
          const newClockOut = correction.requestedClockOut || correction.attendance.clockOut;

          let workedHours = 0;
          let regularHours = 0;
          let overtimeHours = 0;

          if (newClockIn && newClockOut) {
            const duration = Math.max(0, (new Date(newClockOut).getTime() - new Date(newClockIn).getTime()) / (1000 * 3600));
            workedHours = parseFloat(duration.toFixed(2));
            regularHours = Math.min(8.0, workedHours);
            if (workedHours > 8.0) overtimeHours = parseFloat((workedHours - 8.0).toFixed(2));
          }

          await tx.attendance.update({
            where: { id: correction.attendanceId },
            data: {
              clockIn: newClockIn,
              clockOut: newClockOut,
              workedHours,
              regularHours,
              overtimeHours,
              isMissingPunch: false,
              status: "PRESENT",
              notes: `Corrected & approved by HR on ${new Date().toISOString().split("T")[0]}`
            }
          });
        }
      });

      return reply.send({ success: true, message: `Correction request ${decision.toLowerCase()} successfully` });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to decide correction", details: err.message });
    }
  });

  // =========================================================================
  // LEAVE MANAGEMENT
  // =========================================================================
  app.get("/leave/policies", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const policies = await prisma.leavePolicy.findMany({
        orderBy: { code: "asc" }
      });
      return reply.send({ policies });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch leave policies", details: err.message });
    }
  });

  app.get("/leave/balances/:employeeId", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId } = req.params as { employeeId: string };
      const currentYear = new Date().getFullYear();

      const balances = await prisma.leaveBalance.findMany({
        where: { employeeId, year: currentYear },
        include: { policy: true }
      });

      return reply.send({ balances, year: currentYear });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch employee leave balances", details: err.message });
    }
  });

  app.get("/leave/requests", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { status, employeeId } = req.query as any;
      const where: any = {};
      if (status && status !== "ALL") where.status = status;
      if (employeeId && employeeId !== "ALL") where.employeeId = employeeId;

      const requests = await prisma.leaveRequest.findMany({
        where,
        orderBy: { createdAt: "desc" },
        include: {
          employee: {
            select: { id: true, employeeNumber: true, firstName: true, lastName: true, department: true }
          },
          policy: true,
          approver: { select: { id: true, name: true } }
        }
      });

      return reply.send({ requests });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch leave requests", details: err.message });
    }
  });

  app.post("/leave/requests", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { employeeId, policyId, startDate, endDate, workingDaysCount, reason, attachmentName } = req.body as any;

      if (!employeeId || !policyId || !startDate || !endDate || !reason) {
        return reply.status(400).send({ error: "Missing required leave request fields" });
      }

      const sDate = new Date(startDate);
      const eDate = new Date(endDate);
      const currentYear = sDate.getFullYear();
      const requestedDays = parseFloat(workingDaysCount) || 1;

      // Check balance eligibility
      let balance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId,
            policyId,
            year: currentYear
          }
        }
      });

      if (!balance) {
        const policy = await prisma.leavePolicy.findUnique({ where: { id: policyId } });
        if (!policy) return reply.status(404).send({ error: "Policy not found" });

        // Auto-create balance if not yet seeded for this year
        balance = await prisma.leaveBalance.create({
          data: {
            employeeId,
            policyId,
            year: currentYear,
            entitledDays: policy.daysPerYear,
            usedDays: 0,
            pendingDays: 0,
            remainingDays: policy.daysPerYear
          }
        });
      }

      if (balance.remainingDays < requestedDays) {
        return reply.status(400).send({
          error: `Insufficient leave balance: Available remaining days: ${balance.remainingDays}, Requested: ${requestedDays}`
        });
      }

      const leaveRequest = await prisma.$transaction(async (tx) => {
        const reqDoc = await tx.leaveRequest.create({
          data: {
            employeeId,
            policyId,
            startDate: sDate,
            endDate: eDate,
            workingDaysCount: requestedDays,
            reason,
            attachmentName: attachmentName || null,
            status: "PENDING"
          }
        });

        await tx.leaveBalance.update({
          where: { id: balance!.id },
          data: {
            pendingDays: { increment: requestedDays }
          }
        });

        return reqDoc;
      });

      return reply.status(201).send({ leaveRequest, message: "Leave request submitted successfully" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to submit leave request", details: err.message });
    }
  });

  app.patch("/leave/requests/:id/decide", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { decision, note } = req.body as { decision: "APPROVED" | "REJECTED"; note?: string };
      const user = (req as any).user;

      const request = await prisma.leaveRequest.findUnique({
        where: { id },
        include: { policy: true }
      });
      if (!request) return reply.status(404).send({ error: "Leave request not found" });

      if (request.status !== "PENDING") {
        return reply.status(400).send({ error: `Request has already been ${request.status}` });
      }

      const year = request.startDate.getFullYear();
      const balance = await prisma.leaveBalance.findUnique({
        where: {
          employeeId_policyId_year: {
            employeeId: request.employeeId,
            policyId: request.policyId,
            year
          }
        }
      });

      await prisma.$transaction(async (tx) => {
        await tx.leaveRequest.update({
          where: { id },
          data: {
            status: decision,
            approverId: user?.id,
            decisionNote: note || null,
            decidedAt: new Date()
          }
        });

        if (balance) {
          if (decision === "APPROVED") {
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                pendingDays: Math.max(0, balance.pendingDays - request.workingDaysCount),
                usedDays: balance.usedDays + request.workingDaysCount,
                remainingDays: Math.max(0, balance.remainingDays - request.workingDaysCount)
              }
            });

            // Mark attendance records as ON_LEAVE for duration
            const curr = new Date(request.startDate);
            const end = new Date(request.endDate);
            while (curr <= end) {
              const dayStr = curr.toISOString().split("T")[0];
              const wDate = new Date(`${dayStr}T00:00:00.000Z`);

              await tx.attendance.upsert({
                where: {
                  employeeId_workDate: {
                    employeeId: request.employeeId,
                    workDate: wDate
                  }
                },
                create: {
                  employeeId: request.employeeId,
                  workDate: wDate,
                  status: "ON_LEAVE",
                  notes: `Approved ${request.policy.name}`
                },
                update: {
                  status: "ON_LEAVE",
                  notes: `Approved ${request.policy.name}`
                }
              });

              curr.setDate(curr.getDate() + 1);
            }
          } else {
            // Rejected -> release pending days
            await tx.leaveBalance.update({
              where: { id: balance.id },
              data: {
                pendingDays: Math.max(0, balance.pendingDays - request.workingDaysCount)
              }
            });
          }
        }
      });

      return reply.send({ success: true, message: `Leave request ${decision.toLowerCase()} successfully` });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to decide leave request", details: err.message });
    }
  });

  // =========================================================================
  // STATUTORY RULES (ZAMBIA VERSIONED CONFIGURATION)
  // =========================================================================
  app.get("/payroll/statutory-rules", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const rules = await prisma.statutoryRuleSet.findMany({
        orderBy: { effectiveFrom: "desc" },
        include: { createdBy: { select: { name: true } } }
      });
      return reply.send({ rules });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch statutory rule sets", details: err.message });
    }
  });

  app.post("/payroll/statutory-rules", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const user = (req as any).user;
      const data = req.body as any;

      if (!data.versionName || !data.payeBands) {
        return reply.status(400).send({ error: "versionName and payeBands are required" });
      }

      const rule = await prisma.statutoryRuleSet.create({
        data: {
          versionName: data.versionName,
          country: data.country || "Zambia",
          currency: data.currency || "ZMW",
          effectiveFrom: data.effectiveFrom ? new Date(data.effectiveFrom) : new Date(),
          effectiveTo: data.effectiveTo ? new Date(data.effectiveTo) : null,
          isActive: data.isActive ?? true,
          notes: data.notes || null,
          payeBands: data.payeBands,
          napsaEmployeeRate: parseFloat(data.napsaEmployeeRate) || 0.05,
          napsaEmployerRate: parseFloat(data.napsaEmployerRate) || 0.05,
          napsaCeiling: parseFloat(data.napsaCeiling) || 30368,
          nhimaEmployeeRate: parseFloat(data.nhimaEmployeeRate) || 0.01,
          nhimaEmployerRate: parseFloat(data.nhimaEmployerRate) || 0.01,
          createdById: user?.id
        }
      });

      return reply.status(201).send({ rule, message: "Statutory rule set created" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to create statutory rule set", details: err.message });
    }
  });

  // =========================================================================
  // SALARY STRUCTURES & PAYROLL WORKFLOW
  // State: DRAFT -> CALCULATED -> REVIEW_REQUIRED -> APPROVED -> PAYMENT_PROCESSING -> PAID
  // =========================================================================
  app.get("/payroll/periods", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const periods = await prisma.payrollPeriod.findMany({
        orderBy: { startDate: "desc" },
        include: {
          preparedBy: { select: { id: true, name: true } },
          approvedBy: { select: { id: true, name: true } },
          paidBy: { select: { id: true, name: true } },
          _count: { select: { records: true } }
        }
      });

      return reply.send({ periods });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch payroll periods", details: err.message });
    }
  });

  app.post("/payroll/periods", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { periodCode, title, startDate, endDate, payoutDate } = req.body as any;
      const user = (req as any).user;

      if (!periodCode || !startDate || !endDate) {
        return reply.status(400).send({ error: "periodCode, startDate and endDate are required" });
      }

      // Duplicate prevention
      const existing = await prisma.payrollPeriod.findUnique({ where: { periodCode } });
      if (existing) {
        return reply.status(400).send({ error: `Payroll period with code ${periodCode} already exists` });
      }

      const period = await prisma.payrollPeriod.create({
        data: {
          periodCode,
          title: title || `${periodCode} Payroll Run`,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          payoutDate: payoutDate ? new Date(payoutDate) : null,
          status: "DRAFT",
          currency: "ZMW",
          preparedById: user?.id,
          preparedAt: new Date()
        }
      });

      return reply.status(201).send({ period, message: "Payroll period initialized in Draft state" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to create payroll period", details: err.message });
    }
  });

  // Calculate / Re-run Payroll for Period
  app.post("/payroll/periods/:id/calculate", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const user = (req as any).user;

      const period = await prisma.payrollPeriod.findUnique({
        where: { id }
      });
      if (!period) return reply.status(404).send({ error: "Payroll period not found" });

      if (period.status === "APPROVED" || period.status === "PAID") {
        return reply.status(400).send({
          error: `Cannot recalculate a finalized or paid payroll period (${period.status}). Edits are locked.`
        });
      }

      // 1. Get Active Statutory Rule Set
      const ruleSet = await prisma.statutoryRuleSet.findFirst({
        where: { isActive: true },
        orderBy: { effectiveFrom: "desc" }
      });

      if (!ruleSet) {
        return reply.status(400).send({
          error: "No active Zambia Statutory Rule Set found. Please configure or initialize statutory rules before calculating payroll."
        });
      }

      // 2. Fetch all active employees
      const employees = await prisma.employee.findMany({
        where: { employmentStatus: { in: ["ACTIVE", "PROBATION"] } },
        include: { shift: true }
      });

      if (employees.length === 0) {
        return reply.status(400).send({ error: "No active employees found to process for payroll" });
      }

      // 3. Process each employee
      const periodStart = new Date(period.startDate);
      const periodEnd = new Date(period.endDate);

      let totalGross = 0;
      let totalTaxable = 0;
      let totalPaye = 0;
      let totalNapsa = 0;
      let totalNhima = 0;
      let totalNet = 0;
      let totalEmployerCost = 0;

      // Delete existing draft records for clean recalculation
      await prisma.employeePayrollRecord.deleteMany({
        where: { periodId: id }
      });

      for (const emp of employees) {
        const baseSalary = emp.baseSalary || 0;

        // Fetch attendance in period to compute actual worked days & overtime
        const attendances = await prisma.attendance.findMany({
          where: {
            employeeId: emp.id,
            workDate: { gte: periodStart, lte: periodEnd }
          }
        });

        // Total working days in period (approx 22-26 days)
        const totalWorkingDays = 26;
        let workedDays = 0;
        let totalOvertimeHours = 0;
        let unpaidAbsenceDays = 0;

        for (const att of attendances) {
          if (att.status === "PRESENT" || att.status === "ON_LEAVE") {
            workedDays += 1;
          } else if (att.status === "HALF_DAY") {
            workedDays += 0.5;
            unpaidAbsenceDays += 0.5;
          } else if (att.status === "ABSENT") {
            unpaidAbsenceDays += 1;
          }
          totalOvertimeHours += att.overtimeHours || 0;
        }

        // Overtime rate: 1.5x regular hourly rate
        const hourlyRate = baseSalary > 0 ? baseSalary / (26 * 8) : 0;
        const overtimePay = parseFloat((totalOvertimeHours * hourlyRate * 1.5).toFixed(2));

        // Absence deduction for unapproved unpaid days
        const dailyRate = baseSalary > 0 ? baseSalary / 26 : 0;
        const absenceDeductions = parseFloat((unpaidAbsenceDays * dailyRate).toFixed(2));

        // Allowances & gross calculation
        const allowances = 0; // Configurable allowances
        const bonuses = 0;
        const grossPay = parseFloat(Math.max(0, baseSalary + overtimePay + allowances + bonuses - absenceDeductions).toFixed(2));

        // STATUTORY CALCULATIONS (Zambia rules)
        // A. NAPSA: 5% of gross up to ceiling (max ceiling is e.g. 30,368 wage ceiling)
        const napsaSubjectGross = Math.min(grossPay, ruleSet.napsaCeiling);
        const napsaEmployee = parseFloat((napsaSubjectGross * ruleSet.napsaEmployeeRate).toFixed(2));
        const napsaEmployer = parseFloat((napsaSubjectGross * ruleSet.napsaEmployerRate).toFixed(2));

        // B. NHIMA: 1% of basic salary
        const nhimaSubject = baseSalary;
        const nhimaEmployee = parseFloat((nhimaSubject * ruleSet.nhimaEmployeeRate).toFixed(2));
        const nhimaEmployer = parseFloat((nhimaSubject * ruleSet.nhimaEmployerRate).toFixed(2));

        // C. PAYE: Taxable pay = Gross - NAPSA Employee (NAPSA is tax-deductible in Zambia)
        const taxablePay = parseFloat(Math.max(0, grossPay - napsaEmployee).toFixed(2));
        let payeTax = 0;

        const bands = (ruleSet.payeBands as any[]) || [];
        for (const band of bands) {
          const bMin = band.min;
          const bMax = band.max !== null ? band.max : Infinity;
          const rate = band.rate;

          if (taxablePay > bMin) {
            const taxableInBand = Math.min(taxablePay, bMax) - bMin;
            if (taxableInBand > 0 && rate > 0) {
              payeTax += taxableInBand * rate;
            }
          }
        }
        payeTax = parseFloat(payeTax.toFixed(2));

        // D. Net Pay & Total Deductions
        const totalDeductions = parseFloat((payeTax + napsaEmployee + nhimaEmployee).toFixed(2));
        const netPay = parseFloat(Math.max(0, grossPay - totalDeductions).toFixed(2));

        totalGross += grossPay;
        totalTaxable += taxablePay;
        totalPaye += payeTax;
        totalNapsa += napsaEmployee;
        totalNhima += nhimaEmployee;
        totalNet += netPay;
        totalEmployerCost += grossPay + napsaEmployer + nhimaEmployer;

        // Bank details snapshot for audit
        const bankSnapshot = {
          bankName: emp.bankName,
          bankBranch: emp.bankBranch,
          bankAccountNumber: emp.bankAccountNumber,
          mobileMoneyProvider: emp.mobileMoneyProvider,
          mobileMoneyNumber: emp.mobileMoneyNumber
        };

        const calcDetails = {
          ruleSetVersion: ruleSet.versionName,
          baseSalary,
          workedDays,
          overtimeHours: totalOvertimeHours,
          overtimePay,
          absenceDeductions,
          napsaCeiling: ruleSet.napsaCeiling,
          napsaSubjectGross,
          napsaEmployee,
          napsaEmployer,
          nhimaEmployee,
          nhimaEmployer,
          taxablePay,
          payeTax,
          totalDeductions,
          netPay,
          calculatedAt: new Date().toISOString()
        };

        await prisma.employeePayrollRecord.create({
          data: {
            periodId: period.id,
            employeeId: emp.id,
            statutoryRuleSetId: ruleSet.id,
            salaryBasis: emp.salaryBasis,
            baseSalary,
            workingDays: totalWorkingDays,
            workedDays,
            overtimeHours: totalOvertimeHours,
            overtimePay,
            allowances,
            bonuses,
            absenceDeductions,
            grossPay,
            taxablePay,
            payeTax,
            napsaEmployee,
            napsaEmployer,
            nhimaEmployee,
            nhimaEmployer,
            totalDeductions,
            netPay,
            paymentMethod: emp.bankAccountNumber ? "BANK_TRANSFER" : (emp.mobileMoneyNumber ? "MOBILE_MONEY" : "CASH"),
            bankDetailsSnapshot: bankSnapshot,
            calculationDetails: calcDetails
          }
        });
      }

      // Update Period totals & state to CALCULATED
      const updatedPeriod = await prisma.payrollPeriod.update({
        where: { id },
        data: {
          status: "CALCULATED",
          totalGross: parseFloat(totalGross.toFixed(2)),
          totalTaxable: parseFloat(totalTaxable.toFixed(2)),
          totalPaye: parseFloat(totalPaye.toFixed(2)),
          totalNapsa: parseFloat(totalNapsa.toFixed(2)),
          totalNhima: parseFloat(totalNhima.toFixed(2)),
          totalNet: parseFloat(totalNet.toFixed(2)),
          totalEmployerCost: parseFloat(totalEmployerCost.toFixed(2)),
          preparedById: user?.id,
          preparedAt: new Date()
        },
        include: { _count: { select: { records: true } } }
      });

      return reply.send({
        success: true,
        message: `Calculated payroll for ${employees.length} employees using statutory rule ${ruleSet.versionName}`,
        period: updatedPeriod
      });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to calculate payroll", details: err.message });
    }
  });

  // Transition: CALCULATED -> REVIEW_REQUIRED
  app.patch("/payroll/periods/:id/review", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const period = await prisma.payrollPeriod.findUnique({ where: { id } });
      if (!period) return reply.status(404).send({ error: "Payroll period not found" });

      if (period.status !== "CALCULATED") {
        return reply.status(400).send({ error: `Period must be CALCULATED before submitting for review (current: ${period.status})` });
      }

      const updated = await prisma.payrollPeriod.update({
        where: { id },
        data: { status: "REVIEW_REQUIRED" }
      });

      return reply.send({ period: updated, message: "Payroll submitted for independent management approval" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to submit for review", details: err.message });
    }
  });

  // Transition: REVIEW_REQUIRED -> APPROVED
  // Enforces Separation of Duties: Preparer cannot approve their own payroll run!
  app.patch("/payroll/periods/:id/approve", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { note } = req.body as { note?: string };
      const user = (req as any).user;

      const period = await prisma.payrollPeriod.findUnique({ where: { id } });
      if (!period) return reply.status(404).send({ error: "Payroll period not found" });

      if (period.status !== "REVIEW_REQUIRED" && period.status !== "CALCULATED") {
        return reply.status(400).send({ error: `Period cannot be approved from status ${period.status}` });
      }

      // Separation of duties check
      // If the same user prepared it, require a separate approver unless user is SUPERADMIN
      const userRoles = Array.isArray(user?.roles) ? user.roles : [user?.roles];
      const isSuperadmin = userRoles.includes("SUPERADMIN");

      if (period.preparedById === user?.id && !isSuperadmin) {
        return reply.status(403).send({
          error: "Separation of Duties Violation: You prepared this payroll run and cannot approve your own submission. An independent Admin or Manager must review and approve."
        });
      }

      const updated = await prisma.payrollPeriod.update({
        where: { id },
        data: {
          status: "APPROVED",
          approvedById: user?.id,
          approvedAt: new Date(),
          approvalNote: note || "Payroll approved for disbursement"
        }
      });

      return reply.send({ period: updated, message: "Payroll successfully approved and locked for disbursement" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to approve payroll", details: err.message });
    }
  });

  // Rejection / Return to Draft
  app.patch("/payroll/periods/:id/reject", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { reason } = req.body as { reason: string };

      if (!reason) return reply.status(400).send({ error: "Rejection reason is required" });

      const updated = await prisma.payrollPeriod.update({
        where: { id },
        data: {
          status: "DRAFT",
          rejectionReason: reason
        }
      });

      return reply.send({ period: updated, message: "Payroll returned to Draft for adjustments" });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to return payroll", details: err.message });
    }
  });

  // Transition: APPROVED -> PAYMENT_PROCESSING -> PAID
  app.patch("/payroll/periods/:id/pay", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const { paymentReference } = req.body as { paymentReference: string };
      const user = (req as any).user;

      const period = await prisma.payrollPeriod.findUnique({ where: { id } });
      if (!period) return reply.status(404).send({ error: "Payroll period not found" });

      if (period.status !== "APPROVED") {
        return reply.status(400).send({
          error: `Cannot execute payment for payroll in status ${period.status}. Explicit approval is required first.`
        });
      }

      const updated = await prisma.payrollPeriod.update({
        where: { id },
        data: {
          status: "PAID",
          paidById: user?.id,
          paidAt: new Date(),
          paymentReference: paymentReference || `DISB-${period.periodCode}-${Date.now().toString().slice(-4)}`
        }
      });

      return reply.send({ period: updated, message: "Payroll marked as Paid. Disbursement confirmed." });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to record payment execution", details: err.message });
    }
  });

  // Records for a Period
  app.get("/payroll/periods/:id/records", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const period = await prisma.payrollPeriod.findUnique({
        where: { id },
        include: {
          records: {
            orderBy: { employee: { employeeNumber: "asc" } },
            include: {
              employee: {
                select: {
                  id: true,
                  employeeNumber: true,
                  firstName: true,
                  lastName: true,
                  department: true,
                  designation: true,
                  nrcNumber: true,
                  tpinNumber: true,
                  napsaNumber: true,
                  nhimaNumber: true,
                  bankName: true,
                  bankAccountNumber: true,
                  mobileMoneyNumber: true
                }
              },
              statutoryRuleSet: true
            }
          }
        }
      });

      if (!period) return reply.status(404).send({ error: "Payroll period not found" });

      return reply.send({ period, records: period.records });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch payroll records", details: err.message });
    }
  });

  // Individual Payslip View
  app.get("/payroll/records/:id/payslip", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { id } = req.params as { id: string };
      const record = await prisma.employeePayrollRecord.findUnique({
        where: { id },
        include: {
          period: true,
          employee: true,
          statutoryRuleSet: true
        }
      });

      if (!record) return reply.status(404).send({ error: "Payroll record not found" });

      return reply.send({ record });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to fetch payslip", details: err.message });
    }
  });

  // =========================================================================
  // AUTHORIZED REPORTS
  // =========================================================================
  app.get("/reports/attendance-summary", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { startDate, endDate, department } = req.query as any;
      const where: any = {};
      if (startDate && endDate) {
        where.workDate = {
          gte: new Date(`${startDate}T00:00:00.000Z`),
          lte: new Date(`${endDate}T23:59:59.999Z`)
        };
      }
      if (department && department !== "ALL") {
        where.employee = { department };
      }

      const records = await prisma.attendance.findMany({
        where,
        include: {
          employee: { select: { employeeNumber: true, firstName: true, lastName: true, department: true } }
        }
      });

      const summary = {
        totalRecords: records.length,
        present: records.filter(r => r.status === "PRESENT").length,
        late: records.filter(r => r.status === "LATE").length,
        absent: records.filter(r => r.status === "ABSENT").length,
        onLeave: records.filter(r => r.status === "ON_LEAVE").length,
        totalOvertimeHours: records.reduce((sum, r) => sum + (r.overtimeHours || 0), 0)
      };

      return reply.send({ summary, count: records.length });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to generate attendance summary report", details: err.message });
    }
  });

  app.get("/reports/statutory-deductions", { preHandler: [authMiddleware] }, async (req: FastifyRequest, reply: FastifyReply) => {
    try {
      const { periodId } = req.query as { periodId: string };
      if (!periodId) return reply.status(400).send({ error: "periodId is required" });

      const records = await prisma.employeePayrollRecord.findMany({
        where: { periodId },
        include: {
          employee: {
            select: { employeeNumber: true, firstName: true, lastName: true, nrcNumber: true, tpinNumber: true, napsaNumber: true, nhimaNumber: true }
          }
        }
      });

      const totals = {
        totalGross: records.reduce((sum, r) => sum + r.grossPay, 0),
        totalTaxable: records.reduce((sum, r) => sum + r.taxablePay, 0),
        totalPaye: records.reduce((sum, r) => sum + r.payeTax, 0),
        totalNapsaEmployee: records.reduce((sum, r) => sum + r.napsaEmployee, 0),
        totalNapsaEmployer: records.reduce((sum, r) => sum + r.napsaEmployer, 0),
        totalNhimaEmployee: records.reduce((sum, r) => sum + r.nhimaEmployee, 0),
        totalNhimaEmployer: records.reduce((sum, r) => sum + r.nhimaEmployer, 0),
        totalNet: records.reduce((sum, r) => sum + r.netPay, 0)
      };

      return reply.send({ records, totals });
    } catch (err: any) {
      req.log.error(err);
      return reply.status(500).send({ error: "Failed to generate statutory report", details: err.message });
    }
  });
}
