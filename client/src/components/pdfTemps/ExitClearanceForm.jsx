import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';

const LOGO = '/images/wah-logo.png';

const styles = StyleSheet.create({
  page: {
    backgroundColor: 'white',
    paddingTop: 24,
    paddingBottom: 24,
    paddingLeft: 26,
    paddingRight: 26,
    fontSize: 10.3,
    fontFamily: 'Times-Roman',
    lineHeight: 1.5,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    marginBottom: 12,
    marginTop: 0,
    gap: 0,
  },
  logo: {
    width: 90,
    height: 90,
    objectFit: 'contain',
    marginRight: 18,
  },
  formTitle: {
    flex: 1,
    fontSize: 21,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: 0,
    marginBottom: 0,
    width: '100%',
  },
  borderBox: {
    borderWidth: 1,
    borderColor: '#333',
    padding: 0,
  },
  table: {
    borderWidth: 1,
    borderColor: '#333',
    marginBottom: 0,
    marginTop: 6,
  },
  tableRow: {
    flexDirection: 'row',
    alignItems: 'stretch',
    minHeight: 21,
  },
  tableCell: {
    borderRightWidth: 1,
    borderBottomWidth: 1,
    borderRightColor: '#333',
    borderBottomColor: '#333',
    fontSize: 10,
    paddingVertical: 4,
    paddingHorizontal: 4,
    flex: 1,
    justifyContent: 'center'
  },
  lastCell: {
    borderRightWidth: 0,
  },
  headerCell: {
    fontWeight: 700,
    backgroundColor: '#eeeeee',
    fontSize: 10.2,
    textAlign: 'center',
    justifyContent: 'center'
  },
  itemList: {
    fontSize: 9.75,
    marginBottom: 2,
    marginLeft: 8,
    textAlign: 'left',
    lineHeight: 1.3,
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    width: 80,
    minHeight: 14,
    marginVertical: 4,
    marginTop: 10
  },
});

const defaultClearanceRows = [
  {
    dep: 'Training - Trainer (HIPP-Supervisor)',
    items: ['Modules', 'Others', ''],
    signature: true,
    comments: ''
  },
  {
    dep: 'Modules (Platform & Innovation Supervisor)',
    items: [
      'Laptop / Desktop',
      'Charger',
      'Mouse, USB',
      'Tablet/Modem',
      'Others'
    ],
    signature: true,
    comments: ''
  },
  {
    dep: 'IT Services',
    items: [
      'Email',
      'WAH Account',
      'Foldex/Induction, EHR',
    ],
    signature: true,
    comments: ''
  },
  {
    dep: 'Facilities',
    items: ['Keys', 'ID Card', 'Table/Chair', 'Others'],
    signature: true,
    comments: ''
  },
  {
    dep: 'Financial Services',
    items: ['Company Loan', 'Others'],
    signature: true,
    comments: ''
  },
  {
    dep: 'Human Resources',
    items: [
      'Separation Document',
      'WAH ID'
    ],
    signature: true,
    comments: ''
  }
];

const ExitClearanceForm = ({ 
  employeeNumber = '',
  employeeName = '',
  supervisorName = '',
  department = '',
  dateOfHire = '',
  lastWorkingDay = '',
  effectivityDate = '',
  clearanceData = defaultClearanceRows
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      {/* Header: Logo on far left, title centered in remainder of row */}
      <View style={styles.headerRow}>
        <Image src={LOGO} style={styles.logo} />
        <Text style={styles.formTitle}>Exit Clearance Form</Text>
      </View>
      <View style={styles.borderBox}>
        {/* Employee Info Table */}
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <View style={styles.tableCell}><Text>Employee Number: {employeeNumber}</Text></View>
            <View style={styles.tableCell}><Text>Department: {department}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCell}><Text>Employee Name: {employeeName}</Text></View>
            <View style={styles.tableCell}><Text>Date of Hire: {dateOfHire}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCell}><Text>Supervisor Name: {supervisorName}</Text></View>
            <View style={styles.tableCell}><Text>Last Working Day: {lastWorkingDay}</Text></View>
          </View>
          <View style={styles.tableRow}>
            <View style={styles.tableCell}><Text> </Text></View>
            <View style={{ ...styles.tableCell, ...styles.lastCell }}><Text>Effectivity Date: {effectivityDate}</Text></View>
          </View>
          <View style={[styles.tableRow, { backgroundColor: '#f2f2f2', minHeight: 18 }]}>
            <View style={{ ...styles.tableCell, ...styles.lastCell, flex: 2 }}>
              <Text style={{ fontWeight: 500, fontSize: 10, textAlign: "center"}}>
                Please accomplish this form in order and return to HR
              </Text>
            </View>
          </View>
        </View>

        {/* Clearance Table */}
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.tableRow}>
            <View style={{ ...styles.tableCell, flex: 1.45, ...styles.headerCell }}>
              <Text>Department</Text>
            </View>
            <View style={{ ...styles.tableCell, flex: 1, ...styles.headerCell }}>
              <Text>Signatory (Name/Signature)</Text>
            </View>
            <View style={{ ...styles.tableCell, flex: 1.3, ...styles.headerCell }}>
              <Text>Item/s Needed</Text>
            </View>
            <View style={{ ...styles.tableCell, flex: 0.9, ...styles.lastCell, ...styles.headerCell }}>
              <Text>Comment (Cleared or Not Cleared)</Text>
            </View>
          </View>
          {/* Data rows */}
          {clearanceData.map((row) => (
            <View key={row.dep} style={styles.tableRow}>
              {/* Department */}
              <View style={{ ...styles.tableCell, flex: 1.45 }}>
                <Text>{row.dep}</Text>
              </View>
              {/* Signature line */}
              <View style={{ ...styles.tableCell, flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <View style={styles.signLine} />
              </View>
              {/* Items */}
              <View style={{ ...styles.tableCell, flex: 1.3, flexDirection: 'column', alignItems: 'flex-start', justifyContent: 'flex-start' }}>
                {row.items && row.items.map(item => (
                  <Text key={item} style={styles.itemList}>{item}</Text>
                ))}
              </View>
              {/* Comments */}
              <View style={{ ...styles.tableCell, ...styles.lastCell, flex: 0.9 }}>
                <Text>{row.comments || ' '}</Text>
              </View>
            </View>
          ))}
        </View>
      </View>
    </Page>
  </Document>
);

export default ExitClearanceForm;