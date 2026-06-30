"use strict";
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var prisma = new client_1.PrismaClient();
var INSTALLATION_STEPS = [
    'Ready to Install',
    'Physical Installation Completed',
    'Installation Checklist',
    'Net Metering Done',
    'System Start Done',
    'System WiFi Setup Done',
    'Installation Completed'
];
function migrate() {
    return __awaiter(this, void 0, void 0, function () {
        var allOrders, migratedCount, _loop_1, _i, allOrders_1, order;
        var _this = this;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    console.log('Starting migration...');
                    return [4 /*yield*/, prisma.solarOrder.findMany({
                            where: {
                                workflowSteps: {
                                    some: {
                                        workflowType: 'INSTALLATION'
                                    }
                                }
                            },
                            include: {
                                workflowSteps: {
                                    where: { workflowType: 'INSTALLATION' },
                                    orderBy: { stepIndex: 'asc' }
                                }
                            }
                        })];
                case 1:
                    allOrders = _b.sent();
                    console.log("Found ".concat(allOrders.length, " orders with INSTALLATION steps."));
                    migratedCount = 0;
                    _loop_1 = function (order) {
                        var isAlreadyMigrated, readyToInstallStep, wasStarted;
                        return __generator(this, function (_c) {
                            switch (_c.label) {
                                case 0:
                                    isAlreadyMigrated = order.workflowSteps.length === 7 && ((_a = order.workflowSteps[6].metadata) === null || _a === void 0 ? void 0 : _a.name) === 'Installation Completed';
                                    if (isAlreadyMigrated) {
                                        return [2 /*return*/, "continue"];
                                    }
                                    console.log("Migrating order ".concat(order.id, " (had ").concat(order.workflowSteps.length, " steps)..."));
                                    readyToInstallStep = order.workflowSteps.find(function (s) { var _a; return ((_a = s.metadata) === null || _a === void 0 ? void 0 : _a.name) === 'Ready to Install'; });
                                    wasStarted = (readyToInstallStep === null || readyToInstallStep === void 0 ? void 0 : readyToInstallStep.status) === 'COMPLETED';
                                    return [4 /*yield*/, prisma.$transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                            return __generator(this, function (_a) {
                                                switch (_a.label) {
                                                    case 0: 
                                                    // Delete old installation steps
                                                    return [4 /*yield*/, tx.solarWorkflowStep.deleteMany({
                                                            where: {
                                                                solarOrderId: order.id,
                                                                workflowType: 'INSTALLATION'
                                                            }
                                                        })];
                                                    case 1:
                                                        // Delete old installation steps
                                                        _a.sent();
                                                        // Create new steps
                                                        return [4 /*yield*/, tx.solarWorkflowStep.createMany({
                                                                data: INSTALLATION_STEPS.map(function (step, index) {
                                                                    var status = 'BLOCKED';
                                                                    if (index === 0) {
                                                                        status = wasStarted ? 'COMPLETED' : 'PENDING';
                                                                    }
                                                                    else if (index === 1 && wasStarted) {
                                                                        status = 'PENDING';
                                                                    }
                                                                    return {
                                                                        solarOrderId: order.id,
                                                                        workflowType: 'INSTALLATION',
                                                                        stepKey: "INST_".concat(index + 1),
                                                                        stepIndex: index + 1,
                                                                        status: status,
                                                                        metadata: { name: step },
                                                                        completedById: (index === 0 && wasStarted) ? readyToInstallStep === null || readyToInstallStep === void 0 ? void 0 : readyToInstallStep.completedById : undefined,
                                                                        completedAt: (index === 0 && wasStarted) ? readyToInstallStep === null || readyToInstallStep === void 0 ? void 0 : readyToInstallStep.completedAt : undefined,
                                                                    };
                                                                })
                                                            })];
                                                    case 2:
                                                        // Create new steps
                                                        _a.sent();
                                                        return [2 /*return*/];
                                                }
                                            });
                                        }); })];
                                case 1:
                                    _c.sent();
                                    console.log("Order ".concat(order.id, " migrated successfully."));
                                    migratedCount++;
                                    return [2 /*return*/];
                            }
                        });
                    };
                    _i = 0, allOrders_1 = allOrders;
                    _b.label = 2;
                case 2:
                    if (!(_i < allOrders_1.length)) return [3 /*break*/, 5];
                    order = allOrders_1[_i];
                    return [5 /*yield**/, _loop_1(order)];
                case 3:
                    _b.sent();
                    _b.label = 4;
                case 4:
                    _i++;
                    return [3 /*break*/, 2];
                case 5:
                    console.log("Migration complete. Migrated ".concat(migratedCount, " orders."));
                    return [2 /*return*/];
            }
        });
    });
}
migrate().catch(console.error).finally(function () { return prisma.$disconnect(); });
