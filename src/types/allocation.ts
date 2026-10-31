export interface UserAllocation {
  id: string;
  owner: string;      // Full display name e.g. "Abdelfattah Al-Masri"
  assignee: string;   // Jira short username / key e.g. "amasri"
  hod: string;        // Team Lead e.g. "Himanshu"
}

export const DEFAULT_USER_ALLOCATIONS: UserAllocation[] = [
  { id: '1', owner: 'Abdelfattah Al-Masri', assignee: 'amasri', hod: 'Himanshu' },
  { id: '2', owner: 'Amnah Hamad Alshamsi', assignee: 'amnaalshamsi', hod: 'Kristine' },
  { id: '3', owner: 'Anish Gokel', assignee: 'agokel', hod: 'Prince' },
  { id: '4', owner: 'Fatma Nasser Al Shamsi', assignee: 'fnshamsi', hod: 'Kristine' },
  { id: '5', owner: 'Hitesh Sharma', assignee: 'sharmakumar', hod: 'Hassan' },
  { id: '6', owner: 'Kholoud Nasser Alsaedi', assignee: 'kalsaedi', hod: 'Himanshu' },
  { id: '7', owner: 'Khaled Alabdouli', assignee: 'khalabdouli', hod: 'Himanshu' },
  { id: '8', owner: 'Maryam Abdullah Ramadan Al', assignee: 'maramadan', hod: 'Kristine' },
  { id: '9', owner: 'Noora Tareq Alsalman', assignee: 'nalsalman', hod: 'Himanshu' },
  { id: '10', owner: 'Prafull Nautiyal', assignee: 'prnautiyal', hod: 'Hassan' },
  { id: '11', owner: 'Purnima Muralidharn', assignee: 'pmuralidharn', hod: 'Himanshu' },
  { id: '12', owner: 'Rajput, Preksha', assignee: 'prrajput', hod: 'Prince' },
  { id: '13', owner: 'Nalin Seth', assignee: 'nseth', hod: 'Himanshu' },
  { id: '14', owner: 'Sakir Kasim', assignee: 'sakasim', hod: 'Hassan' },
  { id: '15', owner: 'Shivaramakrishnan Paramesw', assignee: 'sparameswaran', hod: 'Hassan' },
  { id: '16', owner: 'Taha Ahmed', assignee: 'tkhalafa', hod: 'Kristine' },
  { id: '17', owner: 'Yaser Mahmoud Elabid', assignee: 'yelabid', hod: 'Kristine' },
  { id: '18', owner: 'Zubair Ghori', assignee: 'zghori', hod: 'Miggy' },
  { id: '19', owner: 'Zuber Mohammed Uddin', assignee: 'zuuddin', hod: 'Himanshu' },
];

export const AVAILABLE_HODS = ['Himanshu', 'Kristine', 'Prince', 'Hassan', 'Miggy'];
