// Seed data taken from a local copy of the R24 database (30 assets, with every movement; the 5 units on retired statuses are left out for now), so the prototype has the
// statuses, custodians, locations and purchase orders the real system holds. It is fixture data only: the people and
// addresses are the generated names in that local copy. Movements become history entries: a check out keeps its team
// member, a later check in keeps the location it was checked in at.
import type { Asset } from '~/data/assets'

export const DB_ASSETS: Asset[] = [
  {
    tag: 'GT-CE-LTP-1226-0021', serial: 'F66AC2XD5VUIXE', model: 'Lenovo EliteBook 7230Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Warranty Processing', statusDate: '2026-10-20', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-68955557', supplier: 'Brown, Steuber and Koepp', cost: 6696.11, warranty: 'Active Warranty', orderDate: '2026-12-21', warrantyMonths: 24,
    history: [
      { id: 'db-95', status: 'Available', date: '2026-07-22', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-96', status: 'In Use', date: '2026-08-11', by: 'Kaitlyn Bashirian', note: '', member: 'Aisha T. Hammes' },
      { id: 'db-97', status: 'Warranty Processing', date: '2026-08-20', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1226-0020', serial: 'A0SIPAFQ1JH125', model: 'Lenovo EliteBook 7230Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Pending Sale', statusDate: '2026-09-12', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-68955557', supplier: 'Brown, Steuber and Koepp', cost: 6696.11, warranty: 'Active Warranty', orderDate: '2026-12-21', warrantyMonths: 24,
    history: [
      { id: 'db-62', status: 'Available', date: '2026-06-05', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-63', status: 'In Use', date: '2026-06-20', by: 'Kaitlyn Bashirian', note: '', member: 'Icie S. Spencer' },
      { id: 'db-64', status: 'Pending Sale', date: '2026-06-26', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1226-0015', serial: 'MIR1GDWAJTKQKM', model: 'Lenovo Swift 968Pro', name: 'Laptop', type: 'Computer Equipment', status: 'Recovery Deduction', statusDate: '2026-10-15', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-4178401', supplier: 'Brown, Steuber and Koepp', cost: 8032.18, warranty: 'Active Warranty', orderDate: '2026-12-31', warrantyMonths: 24,
    history: [
      { id: 'db-98', status: 'Available', date: '2026-07-23', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-99', status: 'In Use', date: '2026-08-11', by: 'Kaitlyn Bashirian', note: '', member: 'Arnaldo S. Rutherford' },
      { id: 'db-100', status: 'Recovery Deduction', date: '2026-08-23', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1226-0014', serial: '6R7HTIFJWLICFE', model: 'Lenovo Swift 968Pro', name: 'Laptop', type: 'Computer Equipment', status: 'In Configuration', statusDate: '2026-10-14', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-4178401', supplier: 'Brown, Steuber and Koepp', cost: 8032.18, warranty: 'Active Warranty', orderDate: '2026-12-31', warrantyMonths: 24,
    history: [
      { id: 'db-65', status: 'Available', date: '2026-06-09', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-66', status: 'In Use', date: '2026-06-26', by: 'Kaitlyn Bashirian', note: '', member: 'Aisha T. Hammes' },
      { id: 'db-67', status: 'In Configuration', date: '2026-07-01', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1226-0009', serial: 'BKVJMC28Q2026Q6N261660', model: 'Lenovo Swift 968Pro', name: 'Laptop', type: 'Computer Equipment', status: 'Returned Device Servicing', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-4178401', supplier: 'Brown, Steuber and Koepp', cost: 8032.18, warranty: 'Active Warranty', orderDate: '2026-12-31', warrantyMonths: 24,
    history: [
      { id: 'db-new-1226-0009', status: 'Returned Device Servicing', date: '2026-10-23', by: 'Kaitlyn Bashirian', note: '' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1226-0003', serial: 'JNXXER63T2026O3L171451', model: 'Lenovo EliteBook 7230Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Pending Deployment', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-68955557', supplier: 'Brown, Steuber and Koepp', cost: 6696.11, warranty: 'Active Warranty', orderDate: '2026-12-21', warrantyMonths: 24,
    history: [
      { id: 'db-new-1226-0003', status: 'Pending Deployment', date: '2026-10-23', by: 'Kaitlyn Bashirian', note: '' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0027', serial: 'GDMLB3LHXBJDHI', model: 'Dell ZenBook 759Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'For Disposal', statusDate: '2026-10-19', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-98538805', supplier: 'Brown, Steuber and Koepp', cost: 0, warranty: 'Active Warranty', orderDate: '2026-11-07', warrantyMonths: 48,
    history: [
      { id: 'db-89', status: 'Available', date: '2026-07-14', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-90', status: 'In Use', date: '2026-07-29', by: 'Kaitlyn Bashirian', note: '', member: 'Greyson W. Gulgowski' },
      { id: 'db-91', status: 'For Disposal', date: '2026-08-16', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0026', serial: 'N7CWQ9IP6RTLC8', model: 'Dell ZenBook 759Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Sold', statusDate: '2026-10-30', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-98538805', supplier: 'Brown, Steuber and Koepp', cost: 0, warranty: 'Active Warranty', orderDate: '2026-11-07', warrantyMonths: 48,
    history: [
      { id: 'db-56', status: 'Available', date: '2026-05-23', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-57', status: 'In Use', date: '2026-06-05', by: 'Kaitlyn Bashirian', note: '', member: 'Nathen Strosin' },
      { id: 'db-58', status: 'Sold', date: '2026-06-12', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0025', serial: 'VGYFGWGDXPRMNJ', model: 'HP ZenBook 3182Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Under Investigation', statusDate: '2026-10-20', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-50265867', supplier: 'Brown, Steuber and Koepp', cost: 4889.9, warranty: 'Active Warranty', orderDate: '2026-11-17', warrantyMonths: 12,
    history: [
      { id: 'db-86', status: 'Available', date: '2026-07-02', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-87', status: 'In Use', date: '2026-07-15', by: 'Kaitlyn Bashirian', note: '', member: 'Nathen Strosin' },
      { id: 'db-88', status: 'Under Investigation', date: '2026-07-24', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0024', serial: 'GXNMTRYMF493G0', model: 'HP ZenBook 3182Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Disposed', statusDate: '2026-09-13', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-50265867', supplier: 'Brown, Steuber and Koepp', cost: 4889.9, warranty: 'Active Warranty', orderDate: '2026-11-17', warrantyMonths: 12,
    history: [
      { id: 'db-53', status: 'Available', date: '2026-05-27', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-54', status: 'In Use', date: '2026-06-09', by: 'Kaitlyn Bashirian', note: '', member: 'Skylar Wintheiser' },
      { id: 'db-55', status: 'Disposed', date: '2026-06-29', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0017', serial: 'GIVK39FIESEURZ', model: 'Asus EliteBook 3036RGB', name: 'Laptop', type: 'Computer Equipment', status: 'Forensic Review', statusDate: '2026-10-19', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-73303263', supplier: 'Brown, Steuber and Koepp', cost: 1624.34, warranty: 'Active Warranty', orderDate: '2026-11-29', warrantyMonths: 48,
    history: [
      { id: 'db-83', status: 'Available', date: '2026-07-01', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-84', status: 'In Use', date: '2026-07-17', by: 'Kaitlyn Bashirian', note: '', member: 'Skylar Wintheiser' },
      { id: 'db-85', status: 'Forensic Review', date: '2026-07-30', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0016', serial: 'G7QXINA9YFNCTL', model: 'Asus EliteBook 3036RGB', name: 'Laptop', type: 'Computer Equipment', status: 'Decommissioned', statusDate: '2026-09-26', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-73303263', supplier: 'Brown, Steuber and Koepp', cost: 1624.34, warranty: 'Active Warranty', orderDate: '2026-11-29', warrantyMonths: 48,
    history: [
      { id: 'db-50', status: 'Available', date: '2026-05-12', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-51', status: 'In Use', date: '2026-05-21', by: 'Kaitlyn Bashirian', note: '', member: 'Samantha S. Schuppe' },
      { id: 'db-52', status: 'Decommissioned', date: '2026-05-28', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0013', serial: 'SJL1URUC9HJTQL', model: 'Asus Swift 2478Elite', name: 'Laptop', type: 'Computer Equipment', status: 'Pending Replacement', statusDate: '2026-10-10', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-22351888', supplier: 'Brown, Steuber and Koepp', cost: 8477.08, warranty: 'No Warranty', orderDate: '2026-11-11',
    history: [
      { id: 'db-92', status: 'Available', date: '2026-07-15', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-93', status: 'In Use', date: '2026-07-30', by: 'Kaitlyn Bashirian', note: '', member: 'Icie S. Spencer' },
      { id: 'db-94', status: 'Pending Replacement', date: '2026-08-13', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0008', serial: 'VGYNFI3Z2026T9M176358', model: 'Asus Swift 2478Elite', name: 'Laptop', type: 'Computer Equipment', status: 'Decommission Checking', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-22351888', supplier: 'Brown, Steuber and Koepp', cost: 8477.08, warranty: 'No Warranty', orderDate: '2026-11-11',
    history: [
      { id: 'db-new-1126-0008', status: 'Decommission Checking', date: '2026-10-23', by: 'Kaitlyn Bashirian', note: '' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0006', serial: 'UUNKSF28Z2026R4D193829', model: 'Dell ZenBook 759Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'In Use', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked Out', custodian: 'Deon Williamson', client: '', owner: 'GoTeam', location: '3242, Barton Ramp, Barangay LIBERTY, BIEN UNIDO, BOHOL 2208, Philippines', po: 'PO-98538805', supplier: 'Brown, Steuber and Koepp', cost: 0, warranty: 'Active Warranty', orderDate: '2026-11-07', warrantyMonths: 48,
    history: [
      { id: 'db-29', status: 'Available', date: '2026-04-23', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-30', status: 'In Transit', date: '2026-05-06', by: 'Kaitlyn Bashirian', note: '', member: 'Stephan P. Pagac' },
      { id: 'db-31', status: 'In Use', date: '2026-05-19', by: 'Kaitlyn Bashirian', note: '', member: 'Stephan P. Pagac' },
      { id: 'db-32', status: 'Available', date: '2026-06-05', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' },
      { id: 'db-33', status: 'In Transit', date: '2026-06-16', by: 'Kaitlyn Bashirian', note: '', member: 'Deon Williamson' },
      { id: 'db-34', status: 'In Use', date: '2026-06-29', by: 'Kaitlyn Bashirian', note: '', member: 'Deon Williamson' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0005', serial: 'LJBVMV43J2026O5G306643', model: 'HP ZenBook 3182Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'In Use', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked Out', custodian: 'Nathen B. Windler', client: '', owner: 'GoTeam', location: '78209, Daphnee Roads, Barangay DARUSSALAM, LANGUYAN, TAWI-TAWI 0342, Philippines', po: 'PO-50265867', supplier: 'Brown, Steuber and Koepp', cost: 4889.9, warranty: 'Active Warranty', orderDate: '2026-11-17', warrantyMonths: 12,
    history: [
      { id: 'db-26', status: 'Available', date: '2026-04-13', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-27', status: 'In Transit', date: '2026-05-08', by: 'Kaitlyn Bashirian', note: '', member: 'Nathen B. Windler' },
      { id: 'db-28', status: 'In Use', date: '2026-05-31', by: 'Kaitlyn Bashirian', note: '', member: 'Nathen B. Windler' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1126-0001', serial: 'ZHGDEF12C2026E2W641715', model: 'Asus EliteBook 3036RGB', name: 'Laptop', type: 'Computer Equipment', status: 'Available', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-73303263', supplier: 'Brown, Steuber and Koepp', cost: 1624.34, warranty: 'Active Warranty', orderDate: '2026-11-29', warrantyMonths: 48,
    history: [
      { id: 'db-21', status: 'Available', date: '2026-03-28', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-22', status: 'In Use', date: '2026-04-09', by: 'Kaitlyn Bashirian', note: '', member: 'Hubert Lakin' },
      { id: 'db-23', status: 'Available', date: '2026-04-26', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' },
      { id: 'db-24', status: 'In Use', date: '2026-05-22', by: 'Kaitlyn Bashirian', note: '', member: 'Shad L. Muller' },
      { id: 'db-25', status: 'Available', date: '2026-06-14', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1026-0023', serial: 'AFRTRNGUYG0KNY', model: 'Acer ZenBook 5653', name: 'Laptop', type: 'Computer Equipment', status: 'Hold Off', statusDate: '2026-09-30', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-66813295', supplier: 'Brown, Steuber and Koepp', cost: 7678.03, warranty: 'Active Warranty', orderDate: '2026-10-26', warrantyMonths: 48,
    history: [
      { id: 'db-77', status: 'Available', date: '2026-06-30', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-78', status: 'In Use', date: '2026-07-06', by: 'Kaitlyn Bashirian', note: '', member: 'Ubaldo Torphy' },
      { id: 'db-79', status: 'Hold Off', date: '2026-07-25', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1026-0022', serial: 'N0ZTWCTXN4YPYH', model: 'Acer ZenBook 5653', name: 'Laptop', type: 'Computer Equipment', status: 'Missing', statusDate: '2026-09-22', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-66813295', supplier: 'Brown, Steuber and Koepp', cost: 7678.03, warranty: 'Active Warranty', orderDate: '2026-10-26', warrantyMonths: 48,
    history: [
      { id: 'db-44', status: 'Available', date: '2026-05-05', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-45', status: 'In Use', date: '2026-05-14', by: 'Kaitlyn Bashirian', note: '', member: 'Katelin Mayert' },
      { id: 'db-46', status: 'Missing', date: '2026-05-21', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1026-0019', serial: 'XAJPWWMTHX7LAT', model: 'Lenovo XPS 9065RGB', name: 'Laptop', type: 'Computer Equipment', status: 'Scheduled Replacement', statusDate: '2026-10-05', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-27799745', supplier: 'Brown, Steuber and Koepp', cost: 8221.63, warranty: 'Active Warranty', orderDate: '2026-10-20', warrantyMonths: 60,
    history: [
      { id: 'db-74', status: 'Available', date: '2026-06-18', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-75', status: 'In Use', date: '2026-07-04', by: 'Kaitlyn Bashirian', note: '', member: 'Katelin Mayert' },
      { id: 'db-76', status: 'Scheduled Replacement', date: '2026-07-11', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1026-0018', serial: 'LE2DVP8WQL85SL', model: 'Lenovo XPS 9065RGB', name: 'Laptop', type: 'Computer Equipment', status: 'Overdue Return', statusDate: '2026-10-06', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-27799745', supplier: 'Brown, Steuber and Koepp', cost: 8221.63, warranty: 'Active Warranty', orderDate: '2026-10-20', warrantyMonths: 60,
    history: [
      { id: 'db-41', status: 'Available', date: '2026-05-13', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-42', status: 'In Use', date: '2026-05-31', by: 'Kaitlyn Bashirian', note: '', member: 'Rosetta S. Kuhic' },
      { id: 'db-43', status: 'Overdue Return', date: '2026-06-06', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1026-0011', serial: 'THHIBC3IQM8LOK', model: 'HP ThinkPad 4669Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Returned Item Check', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-23303712', supplier: 'Brown, Steuber and Koepp', cost: 3634.47, warranty: 'Active Warranty', orderDate: '2026-10-18', warrantyMonths: 48,
    history: [
      { id: 'db-80', status: 'Available', date: '2026-07-05', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-81', status: 'In Use', date: '2026-07-14', by: 'Kaitlyn Bashirian', note: '', member: 'Samantha S. Schuppe' },
      { id: 'db-82', status: 'Returned Item Check', date: '2026-07-27', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1026-0007', serial: 'NVWDSO23H2026O3C634762', model: 'HP ThinkPad 4669Wireless', name: 'Laptop', type: 'Computer Equipment', status: 'Available', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-23303712', supplier: 'Brown, Steuber and Koepp', cost: 3634.47, warranty: 'Active Warranty', orderDate: '2026-10-18', warrantyMonths: 48,
    history: [
      { id: 'db-18', status: 'Available', date: '2026-03-08', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-19', status: 'In Use', date: '2026-03-20', by: 'Kaitlyn Bashirian', note: '', member: 'Marilie Ebert' },
      { id: 'db-20', status: 'Available', date: '2026-03-25', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-1026-0004', serial: 'POKNWU43G2026T3O703943', model: 'Acer ZenBook 5653', name: 'Laptop', type: 'Computer Equipment', status: 'In Use', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked Out', custodian: 'Stephan P. Pagac', client: '', owner: 'GoTeam', location: '4794, Elena Key, Barangay BALAGUEN, MAGSAYSAY, PALAWAN 2062, Philippines', po: 'PO-66813295', supplier: 'Brown, Steuber and Koepp', cost: 7678.03, warranty: 'Active Warranty', orderDate: '2026-10-26', warrantyMonths: 48,
    history: [
      { id: 'db-12', status: 'Available', date: '2026-02-23', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-13', status: 'In Use', date: '2026-03-18', by: 'Kaitlyn Bashirian', note: '', member: 'Deon Williamson' },
      { id: 'db-14', status: 'Available', date: '2026-03-24', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' },
      { id: 'db-15', status: 'In Use', date: '2026-04-04', by: 'Kaitlyn Bashirian', note: '', member: 'Nathen B. Windler' },
      { id: 'db-16', status: 'Available', date: '2026-04-21', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' },
      { id: 'db-17', status: 'In Use', date: '2026-05-05', by: 'Kaitlyn Bashirian', note: '', member: 'Stephan P. Pagac' }
    ]
  },
  {
    tag: 'GT-CE-LTP-0127-0008', serial: 'WFXFLWP6U4M9JH', model: 'HP XPS 3598Elite', name: 'Laptop', type: 'Computer Equipment', status: 'Charged Deduction', statusDate: '2026-09-19', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-79401763', supplier: 'Brown, Steuber and Koepp', cost: 6977.16, warranty: 'Active Warranty', orderDate: '2027-01-11', warrantyMonths: 36,
    history: [
      { id: 'db-104', status: 'Available', date: '2026-07-22', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-105', status: 'In Use', date: '2026-07-30', by: 'Kaitlyn Bashirian', note: '', member: 'Katelin Mayert' },
      { id: 'db-106', status: 'Charged Deduction', date: '2026-08-09', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-0127-0007', serial: 'KAXLNYRHZQAXX0', model: 'HP XPS 3598Elite', name: 'Laptop', type: 'Computer Equipment', status: 'For IT Configuration', statusDate: '2026-10-10', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-79401763', supplier: 'Brown, Steuber and Koepp', cost: 6977.16, warranty: 'Active Warranty', orderDate: '2027-01-11', warrantyMonths: 36,
    history: [
      { id: 'db-71', status: 'Available', date: '2026-06-22', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-72', status: 'In Use', date: '2026-07-12', by: 'Kaitlyn Bashirian', note: '', member: 'Rosetta S. Kuhic' },
      { id: 'db-73', status: 'For IT Configuration', date: '2026-07-20', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-0127-0006', serial: 'WRRALGEUGZAH4X', model: 'HP XPS 3598Elite', name: 'Laptop', type: 'Computer Equipment', status: 'Pending Return', statusDate: '2026-09-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'IT Storage Room', po: 'PO-79401763', supplier: 'Brown, Steuber and Koepp', cost: 6977.16, warranty: 'Active Warranty', orderDate: '2027-01-11', warrantyMonths: 36,
    history: [
      { id: 'db-38', status: 'Available', date: '2026-04-30', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-39', status: 'In Use', date: '2026-05-13', by: 'Kaitlyn Bashirian', note: '', member: 'Arnaldo S. Rutherford' },
      { id: 'db-40', status: 'Pending Return', date: '2026-05-31', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' }
    ]
  },
  {
    tag: 'GT-CE-LTP-0127-0005', serial: 'FE40OFWXQF2BCC', model: 'MacBook Pro 1105RGB', name: 'Laptop', type: 'Computer Equipment', status: 'Gifted', statusDate: '2026-09-20', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked In', custodian: '', client: '', owner: 'GoTeam', location: 'Head Office Vault', po: 'PO-65241841', supplier: 'Brown, Steuber and Koepp', cost: 2976.98, warranty: 'Active Warranty', orderDate: '2027-01-15', warrantyMonths: 48,
    history: [
      { id: 'db-101', status: 'Available', date: '2026-07-21', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-102', status: 'In Use', date: '2026-07-27', by: 'Kaitlyn Bashirian', note: '', member: 'Rosetta S. Kuhic' },
      { id: 'db-103', status: 'Gifted', date: '2026-08-08', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'Head Office Vault' }
    ]
  },
  {
    tag: 'GT-CE-LTP-0127-0002', serial: 'LZADWO63A2027P4P262601', model: 'HP XPS 3598Elite', name: 'Laptop', type: 'Computer Equipment', status: 'In Use', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked Out', custodian: 'Hubert Lakin', client: '', owner: 'GoTeam', location: '8375, Satterfield Inlet, Barangay DAYANKI, BURGOS, ILOCOS SUR 2181, Philippines', po: 'PO-79401763', supplier: 'Brown, Steuber and Koepp', cost: 6977.16, warranty: 'Active Warranty', orderDate: '2027-01-11', warrantyMonths: 36,
    history: [
      { id: 'db-7', status: 'Available', date: '2026-01-26', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-8', status: 'In Transit', date: '2026-02-19', by: 'Kaitlyn Bashirian', note: '', member: 'Hubert Lakin' },
      { id: 'db-9', status: 'In Use', date: '2026-02-25', by: 'Kaitlyn Bashirian', note: '', member: 'Hubert Lakin' }
    ]
  },
  {
    tag: 'GT-CE-LTP-0127-0001', serial: 'WSWRVK1E2027H3G412611', model: 'MacBook Pro 1105RGB', name: 'Laptop', type: 'Computer Equipment', status: 'In Use', statusDate: '2026-10-23', techPack: 'Monthly Rental', currency: 'USD', movementStatus: 'Checked Out', custodian: 'Marilie Ebert', client: '', owner: 'GoTeam', location: '776, Arch Hill, Barangay DAGUPAN, QUEZON, NUEVA VIZCAYA 1245, Philippines', po: 'PO-65241841', supplier: 'Brown, Steuber and Koepp', cost: 2976.98, warranty: 'Active Warranty', orderDate: '2027-01-15', warrantyMonths: 48,
    history: [
      { id: 'db-1', status: 'Available', date: '2026-01-31', by: 'Kaitlyn Bashirian', note: '' },
      { id: 'db-2', status: 'In Transit', date: '2026-02-09', by: 'Kaitlyn Bashirian', note: '', member: 'Deon Williamson' },
      { id: 'db-3', status: 'In Use', date: '2026-02-19', by: 'Kaitlyn Bashirian', note: '', member: 'Deon Williamson' },
      { id: 'db-4', status: 'Available', date: '2026-03-15', by: 'Kaitlyn Bashirian', note: '', movement: 'Check In', location: 'IT Storage Room' },
      { id: 'db-5', status: 'In Transit', date: '2026-03-31', by: 'Kaitlyn Bashirian', note: '', member: 'Marilie Ebert' },
      { id: 'db-6', status: 'In Use', date: '2026-04-11', by: 'Kaitlyn Bashirian', note: '', member: 'Marilie Ebert' }
    ]
  }
]

/** Employee numbers of the people in the local copy. */
export const DB_EMP_NO: Record<string, string> = {
  'Aisha T. Hammes': '685915',
  'Arnaldo S. Rutherford': '873454',
  'Deon Williamson': '138591',
  'Greyson W. Gulgowski': '225277',
  'Hubert Lakin': '372053',
  'Icie S. Spencer': '183800',
  'Kaitlyn Bashirian': '250130',
  'Katelin Mayert': '550197',
  'Marilie Ebert': '512525',
  'Nathen B. Windler': '924593',
  'Nathen Strosin': '207587',
  'Rosetta S. Kuhic': '521303',
  'Samantha S. Schuppe': '584980',
  'Shad L. Muller': '615131',
  'Skylar Wintheiser': '267334',
  'Stephan P. Pagac': '413561',
  'Ubaldo Torphy': '685232'
}

/** The address each team member's units were checked out to. */
export const DB_ADDRESS: Record<string, string> = {
  'Aisha T. Hammes': '9733, Jennyfer Estate, Barangay ASISIG, SAN ENRIQUE, ILOILO 9121, Philippines',
  'Arnaldo S. Rutherford': '70996, Cartwright Radial, Barangay TUNGIB-LIPATA, BUENAVISTA, MARINDUQUE 1852, Philippines',
  'Deon Williamson': '3242, Barton Ramp, Barangay LIBERTY, BIEN UNIDO, BOHOL 2208, Philippines',
  'Greyson W. Gulgowski': '47422, Keeling Drives, Barangay BUGANG, SAGAY, CAMIGUIN 6214, Philippines',
  'Hubert Lakin': '8375, Satterfield Inlet, Barangay DAYANKI, BURGOS, ILOCOS SUR 2181, Philippines',
  'Icie S. Spencer': '660, Feeney Port, Barangay BOA, CAGDIANAO, DINAGAT ISLANDS 3828, Philippines',
  'Katelin Mayert': '607, Harvey Trafficway, Barangay MARTIRES DEL 96, PATEROS, TAGUIG - PATEROS 7014, Philippines',
  'Marilie Ebert': '776, Arch Hill, Barangay DAGUPAN, QUEZON, NUEVA VIZCAYA 1245, Philippines',
  'Nathen B. Windler': '78209, Daphnee Roads, Barangay DARUSSALAM, LANGUYAN, TAWI-TAWI 0342, Philippines',
  'Nathen Strosin': '2895, Rowe Summit, Barangay LAGAYAS, TIPO-TIPO, BASILAN 3126, Philippines',
  'Rosetta S. Kuhic': '949, Konopelski Drives, Barangay LIBERTY, LORETO, DINAGAT ISLANDS 4090, Philippines',
  'Samantha S. Schuppe': '2093, Hauck Turnpike, Barangay ANNINIPAN, FLORA, APAYAO 8472, Philippines',
  'Shad L. Muller': '73106, Edna Underpass, Barangay LANGKILA-AN, TRENTO, AGUSAN DEL SUR 3244, Philippines',
  'Skylar Wintheiser': '862, Eudora Corner, Barangay UPPER BICUTAN, TAGUIG, TAGUIG - PATEROS 7420, Philippines',
  'Stephan P. Pagac': '4794, Elena Key, Barangay BALAGUEN, MAGSAYSAY, PALAWAN 2062, Philippines',
  'Ubaldo Torphy': '239, Gertrude Well, Barangay RIZAL DISTRICT (POB.), SAN LEONARDO, NUEVA ECIJA 6581, Philippines'
}

/** The client company of the people units are checked out to. */
export const DB_COMPANY: Record<string, string> = {
  'Deon Williamson': 'Friesen, McCullough and Douglas',
  'Hubert Lakin': 'Friesen, McCullough and Douglas',
  'Marilie Ebert': 'Friesen, McCullough and Douglas',
  'Nathen B. Windler': 'Friesen, McCullough and Douglas',
  'Shad L. Muller': 'Friesen, McCullough and Douglas',
  'Stephan P. Pagac': 'Friesen, McCullough and Douglas'
}
