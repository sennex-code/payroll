import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image, Font } from '@react-pdf/renderer';

// Register built-in Helvetica (supports ✓)
Font.register({ family: "Helvetica" });

const header = "/images/WAHHeader.jpg"; // Use your actual path

const styles = StyleSheet.create({
  page: {
    backgroundColor: 'white',
    fontFamily: 'Times-Roman', // Use Helvetica for check compatibility!
    color: '#101010',
    fontSize: 11,
    paddingTop: 20,
    paddingBottom: 38,
    paddingLeft: 48,
    paddingRight: 48,
    lineHeight: 1.5,
    position: 'relative',
  },
  headerImage: {
    width: '100%',
    minHeight: 52,
    marginBottom: 18,
  },
  formTitle: {
    marginTop: 10,
    fontWeight: 500,
    fontSize: 15,
    textAlign: 'center',
    letterSpacing: 1.6,
    marginBottom: 16,
  },
  tableSection: {
    border: '1pt solid #7f7f7f',
    marginBottom: 18,
  },
  tableRow: {
    flexDirection: 'row',
    borderBottom: '1pt solid #b0b0b0',
    minHeight: 20,
  },
  tableHeader: {
    backgroundColor: '#f2f2f2',
    fontWeight: 700,
    textAlign: 'center',
    paddingVertical: 4,
    fontSize: 11,
    letterSpacing: 0.6,
    borderBottom: '1pt solid #b0b0b0'
  },
  tableCell: {
    flex: 1,
    borderRight: '1pt solid #b0b0b0',
    padding: 4,
    paddingLeft: 8,
    fontSize: 11,
  },
  tableCellLast: {
    flex: 1,
    padding: 4,
    paddingLeft: 8,
    fontSize: 11,
  },
  reasonTitle: {
    fontSize: 12,
    fontWeight: 700,
    marginBottom: 4,
    marginTop: 6
  },
  reasonSubtitle: {
    fontSize: 10.1,
    color: '#b32526',
    marginBottom: 9,
    marginLeft: 1,
    fontWeight: 500,
  },
  checkList: {
    marginBottom: 6,
    marginLeft: 6,
  },
  checkRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 2.4,
  },
  checkBox: {
    width: 12,
    height: 12,
    border: '1pt solid #111',
    marginRight: 7,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    backgroundColor: '#000',
  },
  checkBoxEmpty: {
    width: 12,
    height: 12,
    border: '1pt solid #111',
    marginRight: 7,
    marginTop: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
  },
  checkMark: {
    fontFamily: 'Helvetica',
    fontSize: 8,
    color: '#fff',
    textAlign: 'center',
    lineHeight: 1,
    fontWeight: 'bold',
  },
  reasonText: {
    fontSize: 11,
    lineHeight: 1.43,
    marginRight: 8,
    fontFamily: 'Helvetica',
  },
  otherUnderline: {
    borderBottomWidth: 1,
    borderBottomColor: '#222',
    marginTop: 11,
    marginBottom: 14,
    width: '100%',
    minHeight: 14
  },
  signLineRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 38,
    marginBottom: 0,
    width: '100%',
  },
  signColumn: {
    alignItems: 'center',
    width: '45%',
  },
  signDateText: {
    fontSize: 9,
    textAlign: 'center',
    marginBottom: 2,
    fontWeight: 400
  },
  signNameText: {
    fontSize: 10.5,
    textAlign: 'center',
    marginBottom: 3,
    fontWeight: 500
  },
  signLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#111',
    width: 146,
    minHeight: 14,
    marginBottom: 5,
  },
  signLabel: {
    fontSize: 10.2,
    textAlign: 'center',
    marginTop: 1,
    fontWeight: 400
  },
  footer: {
    color: '#bbb',
    position: 'absolute',
    left: 48,
    right: 0,
    bottom: 14,
    fontSize: 9,
    textAlign: 'left'
  }
});

const REASONS = [
  "Family and/or personal reasons",
  "Better career opportunity",
  "Pregnancy",
  "Poor Health/Physical Disability",
  "Relocation to another City/Country",
  "Termination",
  "Dissatisfaction with salary/allowances",
  "Dissatisfaction with the type of work",
  "Conflict with other employees/Supervisor/Manager"
];

const ResignationFormDocument = ({ 
  name = '',
  position = '',
  department = '',
  dateOfJoining = '',
  resignationDate = '',
  lastWorkingDay = '',
  checkedReasons = [],
  otherReason = '',
  employeeSignDate = '',
  employeeSignName = '',
  supervisorSignDate = '',
  supervisorSignName = ''
}) => (
  <Document>
    <Page size="A4" style={styles.page}>
      <Image src={header} style={styles.headerImage} />

      <Text style={styles.formTitle}>
        EMPLOYEE RESIGNATION FORM
      </Text>

      {/* Table Section */}
      <View style={styles.tableSection}>
        <View style={[styles.tableRow, styles.tableHeader]}>
          <Text style={{ flex: 1 }}>EMPLOYEE RESIGNATION</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Name: {name}</Text>
          <Text style={styles.tableCell}>Date of Joining: {dateOfJoining}</Text>
        </View>
        <View style={styles.tableRow}>
          <Text style={styles.tableCell}>Position: {position}</Text>
          <Text style={styles.tableCell}>Resignation Date: {resignationDate}</Text>
        </View>
        <View style={[styles.tableRow, { borderBottomWidth: 0 }]}>
          <Text style={styles.tableCell}>Department: {department}</Text>
          <Text style={styles.tableCellLast}>Last Working Day: {lastWorkingDay}</Text>
        </View>
      </View>

      {/* Reason for leaving */}
      <Text style={styles.reasonTitle}>REASON FOR LEAVING:</Text>
      <Text style={styles.reasonSubtitle}>Select one or more</Text>
      <View style={styles.checkList}>
        {REASONS.map((reason, idx) => {
          const isChecked = checkedReasons.includes(idx);
          return (
            <View key={reason} style={styles.checkRow}>
              <View style={isChecked ? styles.checkBox : styles.checkBoxEmpty}>
                {isChecked && <Text style={styles.checkMark}>✓</Text>}
              </View>
              <Text style={styles.reasonText}>{reason}</Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.reasonText}>Others: {otherReason}</Text>
      {!otherReason && <View style={styles.otherUnderline} />}

      {/* Signatures */}
      <View style={styles.signLineRow}>
        <View style={styles.signColumn}>
          {employeeSignDate && <Text style={styles.signDateText}>{employeeSignDate}</Text>}
          {employeeSignName && <Text style={styles.signNameText}>{employeeSignName}</Text>}
          <View style={styles.signLine} />
          <Text style={styles.signLabel}>Date & Signature of Employee</Text>
        </View>
        <View style={styles.signColumn}>
          {supervisorSignDate && <Text style={styles.signDateText}>{supervisorSignDate}</Text>}
          {supervisorSignName && <Text style={styles.signNameText}>{supervisorSignName}</Text>}
          <View style={styles.signLine} />
          <Text style={styles.signLabel}>Date & Signature of Supervisor</Text>
        </View>
      </View>

      <Text style={styles.footer}>Footer</Text>
    </Page>
  </Document>
);

export default ResignationFormDocument;