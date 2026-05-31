import Employee from '../models/employeeModel.js';
import asyncHandler from 'express-async-handler';

// @desc    Create a new employee
// @route   POST /api/employees
// @access  Private/Admin
const createEmployee = asyncHandler(async (req, res) => {
  const {
    name,
    gender,
    address,
    dob,
    phoneNumber,
    emergencyContactNumber,
    maritalStatus,
    salary,
    advanceAmount,
    debtAmount,
    clientId,
  } = req.body;

  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const employee = new Employee({
    name,
    gender,
    address,
    dob,
    phoneNumber,
    emergencyContactNumber,
    maritalStatus,
    salary,
    advanceAmount,
    debtAmount,
    clientId: clientId.trim(),
  });

  const createdEmployee = await employee.save();
  res.status(201).json(createdEmployee);
});

// @desc    Get all employees
// @route   GET /api/employees
// @access  Private
const getEmployees = asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const employees = await Employee.find({ clientId });
  res.json(employees);
});


// @desc    Update employee
// @route   PUT /api/employees/:id
// @access  Private/Admin
const updateEmployee = asyncHandler(async (req, res) => {
  const { clientId } = req.body;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const employee = await Employee.findOne({ _id: req.params.id, clientId: clientId.trim() });
  
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found or does not belong to this client');
  }

  if (req.body.name !== undefined) employee.name = req.body.name;
  if (req.body.gender !== undefined) employee.gender = req.body.gender;
  if (req.body.address !== undefined) employee.address = req.body.address;
  if (req.body.dob !== undefined) employee.dob = req.body.dob;
  if (req.body.phoneNumber !== undefined) employee.phoneNumber = req.body.phoneNumber;
  if (req.body.emergencyContactNumber !== undefined) employee.emergencyContactNumber = req.body.emergencyContactNumber;
  if (req.body.maritalStatus !== undefined) employee.maritalStatus = req.body.maritalStatus;
  if (req.body.salary !== undefined) employee.salary = req.body.salary;
  if (req.body.advanceAmount !== undefined) employee.advanceAmount = req.body.advanceAmount;
  if (req.body.debtAmount !== undefined) employee.debtAmount = req.body.debtAmount;
  if (req.body.isActive !== undefined) employee.isActive = req.body.isActive;

  const updatedEmployee = await employee.save();
  res.json(updatedEmployee);
});

// @desc    Delete an employee
// @route   DELETE /api/employees/:id
// @access  Private/Admin
const deleteEmployee = asyncHandler(async (req, res) => {
  const { clientId } = req.query;
  
  if (!clientId) {
    res.status(400);
    throw new Error('Client ID is required');
  }

  const employee = await Employee.findOne({ _id: req.params.id, clientId });
  
  if (!employee) {
    res.status(404);
    throw new Error('Employee not found or does not belong to this client');
  }

  await employee.deleteOne();
  res.json({ message: 'Employee removed' });
});

export {
  createEmployee,
  getEmployees,
  updateEmployee,
  deleteEmployee,
};
