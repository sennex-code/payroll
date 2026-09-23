import React from 'react';
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer';

// Legal size: 8.5x14 inches = 612 x 1008 pt
const styles = StyleSheet.create({
  page: {
    backgroundColor: 'white',
    fontFamily: 'Times-Roman',
    color: '#101010',
    fontSize: 12,
    paddingTop: 54,
    paddingBottom: 54,
    paddingLeft: 72,
    paddingRight: 72,
    lineHeight: 1.55,
    position: 'relative',
  },
  docTitle: {
    fontSize: 16,
    fontWeight: 700,
    textAlign: 'center',
    marginTop: 20,
    marginBottom: 2,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  docSubtitle: {
    fontSize: 11,
    textAlign: 'center',
    marginBottom: 16,
    marginTop: 2,
  },
  labelAllMen: {
    fontWeight: 700,
    marginBottom: 11,
    marginTop: 10,
    letterSpacing: 0.8,
  },
  paragraph: {
    textAlign: 'justify',
    marginBottom: 9,
  },
  andLine: {
    textAlign: 'center',
    marginTop: 8,
    marginBottom: 8,
    fontSize: 12,
  },
  partyBlock: {
    marginBottom: 7,
    textAlign: 'justify',
  },
  sectionTitle: {
    marginTop: 14,
    marginBottom: 5,
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: 11.5,
    letterSpacing: 0.7,
  },
  sectionContent: {
    fontSize: 11,
    lineHeight: 1.57,
    textAlign: 'justify',
    marginBottom: 8,
    marginTop: 1,
  },
  subSectionTitle: {
    fontWeight: 700,
    textTransform: 'uppercase',
    fontSize: 11,
    marginBottom: 4,
    marginTop: 14,
  },
  underlineDivider: {
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    marginTop: 13,
    marginBottom: 12,
  },
  bold: { fontWeight: 700 },
  underlineText: { textDecoration: 'underline' },
  blankField: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2,
    marginHorizontal: 3,
    minWidth: 100,
    display: 'inline',
  },
  blankFieldShort: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 2,
    marginHorizontal: 3,
    minWidth: 40,
    display: 'inline',
  },
  listItem: {
    fontSize: 11,
    lineHeight: 1.57,
    marginBottom: 8,
  },

  // Signature Section Styles
  signatureSectionDivider: {
    borderBottomWidth: 2,
    borderBottomColor: '#000',
    marginTop: 40,
    marginBottom: 12,
  },
  firstPartyLabel: {
    fontWeight: 700,
    marginBottom: 12,
    fontSize: 11,
  },
  companyName: {
    fontSize: 11,
    marginBottom: 8,
  },
  byLabel: {
    marginBottom: 16,
    fontSize: 11,
  },
  dpoSignatureBlock: {
    marginBottom: 16,
  },
  dpoNameText: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 6,
    alignSelf: 'flex-start',
  },
  dpoTitleText: {
    fontSize: 11,
    marginBottom: 20,
  },
  secondPartyLabel: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 4,
  },
  secondPartyBlank: {
    fontSize: 11,
    marginBottom: 12,
    fontStyle: 'italic',
  },
  employeeSignatureBlock: {
    marginBottom: 12,
  },
  employeeNameText: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 6,
    alignSelf: 'flex-start',
  },
  employeeIdRow: {
    fontSize: 11,
    marginBottom: 24,
  },
  employeeIdLabel: {
    marginRight: 4,
  },

  presenceNotice: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 12,
  },
  presenceRow: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  presenceCol: {
    alignItems: 'flex-start',
    width: '44%',
  },
  presenceSignatureBlock: {
    alignItems: 'flex-start',
  },
  presenceNameText: {
    fontWeight: 700,
    fontSize: 11,
    marginBottom: 2,
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    paddingBottom: 6,
    alignSelf: 'flex-start',
  },
  presenceRoleText: {
    fontSize: 11,
  },

  pageFooter: {
    position: 'absolute',
    bottom: 32,
    left: 72,
    right: 72,
    textAlign: 'right',
    fontSize: 9,
    color: '#444',
    fontStyle: 'italic',
  },
});

const NDADocument = ({
  employeeName = '',
  employeeId = '',
  employeeAddress = '',
  signatureDay = '',
  signatureMonth = '',
  signatureYear = '',
  signatureCity = '',
  witness1Name = 'Ms. Jhuvy C. Dizon',
  witness1Title = 'Admin & Operations Officer',
  witness2Name = 'Robert Michael Martinez',
  witness2Title = 'Supervising Partner for Network and System',
}) => (
  <Document>
    <Page size="LEGAL" style={styles.page}>
      <Text style={styles.docTitle}>NON-DISCLOSURE AGREEMENT</Text>
      <Text style={styles.docSubtitle}>Wireless Access for Health Digital Platform (For Employees)</Text>
      <Text style={styles.labelAllMen}>KNOW ALL MEN BY THESE PRESENTS:</Text>
      
      <Text style={[styles.paragraph, { fontWeight: 700 }]}>
        This AGREEMENT, made and executed by and between:
      </Text>

      <Text style={styles.partyBlock}>
        <Text style={styles.bold}>WIRELESS ACCESS FOR HEALTH INITIATIVE, INC. (WAH-NGO)</Text>, a multi-sector, non-profit, non-governmental organization with office address at 2nd Floor, Diwa ng Tarlac, Romulo Boulevard, Barangay San Vicente, Tarlac City, Philippines, represented herein by <Text style={styles.bold}>Kevin Greg Alvarado</Text>, <Text style={styles.bold}>Data Protection Officer</Text>, hereinafter referred to as the <Text style={styles.bold}>"FIRST PARTY"</Text>;
      </Text>

      <Text style={styles.andLine}>-AND-</Text>

      <Text style={styles.partyBlock}>
        <Text style={styles.blankField}>{employeeName}</Text>, an employee of Wireless Access for Health Initiative, Inc., with Employee ID Number <Text style={styles.blankFieldShort}>{employeeId}</Text> and residence address at <Text style={styles.blankField}>{employeeAddress}</Text>, hereinafter referred to as the <Text style={styles.bold}>"SECOND PARTY."</Text>
      </Text>

      <View style={styles.underlineDivider} />

      {/* WITNESSETH Section */}
      <Text style={styles.sectionTitle}>WITNESSETH:</Text>

      <Text style={styles.sectionContent}>
        <Text style={styles.bold}>WHEREAS</Text>, the FIRST PARTY is the developer, provider, and administrator of a digital health platform integrated with the Philippine Health Information Exchange (PHIE) and other related reporting systems;
      </Text>

      <Text style={styles.sectionContent}>
        <Text style={styles.bold}>WHEREAS</Text>, the FIRST PARTY grants the SECOND PARTY authorized access to said platform as part of their official duties and responsibilities;
      </Text>

      <Text style={styles.sectionContent}>
        <Text style={styles.bold}>WHEREAS</Text>, such access includes exposure to personal information, sensitive personal information, health data, system credentials, reports, and other confidential information protected under applicable laws;
      </Text>

      <Text style={styles.sectionContent}>
        <Text style={styles.bold}>WHEREAS</Text>, the SECOND PARTY acknowledges their legal and ethical obligation to ensure the confidentiality, integrity, and security of all information accessed in the course of their employment;
      </Text>

      <Text style={styles.sectionContent}>
        <Text style={styles.bold}>NOW, THEREFORE</Text>, the SECOND PARTY agrees as follows:
      </Text>

      {/* A. DATA PRIVACY */}
      <Text style={styles.subSectionTitle}>A. DATA PRIVACY AND CONFIDENTIALITY OBLIGATIONS</Text>

      <Text style={styles.paragraph}>
        The SECOND PARTY acknowledges that "Confidential Information" includes, but is not limited to, personal information, sensitive personal information such as health records and PhilHealth data, system credentials, reports, analytics, and all non-public data accessed through the WAH platform and the Philippine Health Information Exchange.
      </Text>

      <Text style={styles.listItem}>
        <Text style={styles.bold}>1.</Text> The SECOND PARTY shall not disclose, share, transfer, publish, or otherwise make available any Confidential Information to any unauthorized person, entity, or third party without prior written consent from the FIRST PARTY. Access to the platform shall be strictly limited to authorized personnel and shall only be conducted through officially designated devices and secure systems approved by the FIRST PARTY. Any changes in access, devices, or authorized users must be formally coordinated with and approved by the FIRST PARTY.
      </Text>

      <Text style={styles.listItem}>
        <Text style={styles.bold}>2.</Text> The SECOND PARTY shall access and process only such information as is necessary for the performance of official duties and shall adhere to the principles of data minimization and need-to-know. The SECOND PARTY shall not copy, download, reproduce, store, screenshot, or transmit any data for personal use or outside authorized systems, nor store such data in personal devices, external drives, or unauthorized cloud-based platforms.
      </Text>

      <Text style={styles.listItem}>
        <Text style={styles.bold}>3.</Text> The SECOND PARTY shall not share login credentials, allow unauthorized access to accounts, or engage in any act that may compromise the confidentiality, integrity, or availability of the system and its data.
      </Text>

      {/* B. DATA SECURITY */}
      <Text style={styles.subSectionTitle}>B. DATA SECURITY AND BREACH REPORTING</Text>

      <Text style={styles.paragraph}>
        The SECOND PARTY agrees to comply with all organizational, physical, and technical security measures implemented by the FIRST PARTY, including maintaining password confidentiality, proper handling of login credentials, use of secure and encrypted systems where applicable, and ensuring proper logout and workstation security at all times.
      </Text>

      <Text style={styles.paragraph}>
        The SECOND PARTY shall immediately report to the FIRST PARTY any actual or suspected data breach, unauthorized access, system vulnerability, or loss or compromise of devices or credentials. Failure to report such incidents in a timely manner shall constitute a violation of this Agreement and may subject the SECOND PARTY to appropriate sanctions.
      </Text>

      {/* C. COMPLIANCE */}
      <Text style={styles.subSectionTitle}>C. COMPLIANCE WITH LAWS AND REGULATIONS</Text>

      <Text style={styles.paragraph}>
        The SECOND PARTY agrees to comply with Republic Act No. 10173, otherwise known as the Data Privacy Act of 2012, its Implementing Rules and Regulations, and all issuances of the National Privacy Commission. The SECOND PARTY shall likewise comply with Department of Health and PhilHealth data governance policies, as well as the internal data privacy, cybersecurity, and operational policies of Wireless Access for Health.
      </Text>

      {/* D. GENERAL PROVISIONS */}
      <Text style={styles.subSectionTitle}>D. GENERAL PROVISIONS AND LIABILITIES</Text>

      <Text style={styles.paragraph}>
        This Agreement shall not be construed as granting the SECOND PARTY any ownership, license, or intellectual property rights over the WAH platform or any data contained therein. All rights remain exclusively with the FIRST PARTY.
      </Text>

      <Text style={styles.paragraph}>
        Any breach of this Agreement, including unauthorized disclosure, misuse of data, or failure to comply with data protection policies, shall subject the SECOND PARTY to administrative sanctions, civil liabilities for damages, and criminal liabilities under applicable laws.
      </Text>

      <Text style={styles.paragraph}>
        In the event of breach or threatened breach of any provision of this Agreement, the FIRST PARTY shall be entitled to seek injunctive relief and pursue all available legal remedies.
      </Text>

      <Text style={styles.paragraph}>
        If any provision of this Agreement is declared invalid or unenforceable, the remaining provisions shall remain valid and enforceable to the fullest extent permitted by law.
      </Text>

      <Text style={styles.paragraph}>
        The obligations under this Agreement, particularly those relating to confidentiality and data privacy, shall survive the termination of employment or engagement of the SECOND PARTY and shall remain binding thereafter.
      </Text>

      <Text style={styles.paragraph}>
        This Agreement shall be read in conjunction with the Non-Disclosure Agreement (Annex C) of the Memorandum of Agreement between Wireless Access for Health Initiative, Inc. and its partner institutions, and shall apply to all employees granted access to the platform.
      </Text>

      {/* SIGNATURE SECTION */}
      <View style={styles.signatureSectionDivider} />

      <Text style={styles.firstPartyLabel}>FIRST PARTY</Text>
      <Text style={styles.companyName}>WIRELESS ACCESS FOR HEALTH INITIATIVE, INC.</Text>
      <Text style={styles.byLabel}>By:</Text>

      <View style={styles.dpoSignatureBlock}>
        <Text style={styles.dpoNameText}>Kevin Greg Alvarado</Text>
        <Text style={styles.dpoTitleText}>Data Protection Officer</Text>
      </View>

      <Text style={styles.secondPartyLabel}>SECOND PARTY</Text>
      <Text style={styles.secondPartyBlank}>(Name & Signature of Employee)</Text>
      
      <View style={styles.employeeSignatureBlock}>
        <Text style={styles.employeeNameText}>{employeeName}</Text>
      </View>
      
      <Text style={styles.employeeIdRow}>
        <Text style={styles.employeeIdLabel}>Employee ID:</Text>
        <Text style={styles.blankFieldShort}>{employeeId}</Text>
      </Text>

      {/* WITNESSES SECTION */}
      <Text style={styles.presenceNotice}>SIGNED IN THE PRESENCE OF:</Text>

      <View style={styles.presenceRow}>
        <View style={styles.presenceCol}>
          <View style={styles.presenceSignatureBlock}>
            <Text style={styles.presenceNameText}>{witness1Name}</Text>
            <Text style={styles.presenceRoleText}>{witness1Title}</Text>
          </View>
        </View>
        <View style={styles.presenceCol}>
          <View style={styles.presenceSignatureBlock}>
            <Text style={styles.presenceNameText}>{witness2Name}</Text>
            <Text style={styles.presenceRoleText}>{witness2Title}</Text>
          </View>
        </View>
      </View>

      {/* Footer */}
      <Text style={styles.pageFooter}>
        Wireless Access for Health | NDA Employee | Page 1 / 1
      </Text>
    </Page>
  </Document>
);

export default NDADocument;