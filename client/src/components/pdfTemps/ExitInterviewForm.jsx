import React from 'react';
import { Document, Page, View, Text, StyleSheet, Image } from '@react-pdf/renderer';

const HEADER_IMAGE = '/images/WAHHeader.jpg';

const styles = StyleSheet.create({
  page: {
    backgroundColor: 'white',
    paddingTop: 0,
    paddingBottom: 20,
    paddingLeft: 40,
    paddingRight: 40,
    fontSize: 10,
    fontFamily: 'Helvetica',
    lineHeight: 1.4,
  },
  headerImage: {
    width: '100%',
    height: 60,
    objectFit: 'contain',
    marginBottom: 16,
  },
  instructionText: {
    fontSize: 10,
    marginBottom: 16,
    lineHeight: 1.5,
    textAlign: 'justify',
  },
  questionContainer: {
    marginBottom: 12,
    lineHeight: 1.6,
  },
  questionText: {
    fontSize: 10,
    textAlign: 'justify',
    marginBottom: 4,
  },
  answerText: {
    fontSize: 9,
    textAlign: 'justify',
    marginBottom: 8,
    paddingLeft: 12,
    color: '#333',
  },
  answerSpace: {
    minHeight: 30,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
  },
  signatureSection: {
    marginTop: 24,
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
  },
  signatureField: {
    width: '45%',
  },
  signatureLabel: {
    fontSize: 9,
    marginBottom: 4,
    fontWeight: 'bold',
  },
  signatureValue: {
    fontSize: 9,
    marginBottom: 4,
  },
  signatureLine: {
    borderBottomWidth: 1,
    borderBottomColor: '#000',
    minHeight: 20,
    marginBottom: 4,
  },
  footer: {
    fontSize: 8,
    textAlign: 'center',
    marginTop: 20,
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#ccc',
    lineHeight: 1.4,
  },
  footerHighlight: {
    color: '#0066CC',
    fontWeight: 'bold',
  },
});

const questions = [
  'What caused you to start looking for a new job in the first place?',
  'Why have you decided to leave the company?',
  'Was a single event responsible for your decision to leave?',
  'What does your new company offer that encouraged you to accept their offer and leave this company?',
  'What do you value about the company?',
  'What did you dislike about the company?',
  'The quality of supervision is important to most people at work. How was your relationship with your manager?',
  'What could your supervisor do to improve his or her management style and skill?',
  'What did you like most about your job?',
  'What did you dislike about your job? What would you change about your job?',
  'Do you feel you had the resources and support necessary to accomplish your job? If not, what was missing?',
  'Did you have clear goals and know what was expected of you in your job?',
  'Did you receive adequate feedback about your performance day-to-day and in the performance development planning process?',
  'Did you clearly understand and feel a part of the accomplishment of the company mission and goals?',
  'Do you have any recommendations regarding our compensation, benefits and other reward and recognition efforts?',
  'What would make you consider working for this company again in the future? Would you recommend the company as a good place to work to your friends and family?',
];

const ExitInterviewForm = ({ answers = [], name = '', position = '', date = '' }) => {
  const renderQuestion = (question, idx, questionNumber) => {
    const answer = answers[idx] || '';

    return (
      <View key={idx} style={styles.questionContainer}>
        <Text style={styles.questionText}>
          <Text style={{ fontWeight: 'bold' }}>{questionNumber}. </Text>
          {question}
        </Text>
        {answer ? (
          <Text style={styles.answerText}>{answer}</Text>
        ) : (
          <View style={styles.answerSpace} />
        )}
      </View>
    );
  };

  return (
    <Document>
      {/* Page 1 */}
      <Page size="A4" style={styles.page}>
        <Image src={HEADER_IMAGE} style={styles.headerImage} />

        <Text style={styles.instructionText}>
          Please answer each question/statement as honestly as possible. Your answers will help Human Resources Management to improve its service to employee needs. All answers are confidential.
        </Text>

        {questions.slice(0, 7).map((question, idx) =>
          renderQuestion(question, idx, idx + 1)
        )}

        <View style={styles.footer}>
          <Text style={styles.footerHighlight}>For Healthier, Happier Communities</Text>
          <Text>2/F Diwang Tariac, Romulo Blvd, San Vicente, Tariac City 2300</Text>
          <Text>Webpage: http://wah.ph/ | Email Address: wah.pilipinas@gmail.com</Text>
          <Text>Contacts: Landline-045-985-5607 / Smart-09985651432 / Globe-09175229170</Text>
        </View>
      </Page>

      {/* Page 2 */}
      <Page size="A4" style={styles.page}>
        <Image src={HEADER_IMAGE} style={styles.headerImage} />

        {questions.slice(7, 14).map((question, idx) =>
          renderQuestion(question, idx + 7, idx + 8)
        )}

        <View style={styles.footer}>
          <Text style={styles.footerHighlight}>For Healthier, Happier Communities</Text>
          <Text>2/F Diwang Tariac, Romulo Blvd, San Vicente, Tariac City 2300</Text>
          <Text>Webpage: http://wah.ph/ | Email Address: wah.pilipinas@gmail.com</Text>
          <Text>Contacts: Landline-045-985-5607 / Smart-09985651432 / Globe-09175229170</Text>
        </View>
      </Page>

      {/* Page 3 */}
      <Page size="A4" style={styles.page}>
        <Image src={HEADER_IMAGE} style={styles.headerImage} />

        {questions.slice(14, 16).map((question, idx) =>
          renderQuestion(question, idx + 14, idx + 15)
        )}

        <View style={styles.signatureSection}>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Name:</Text>
            {name ? (
              <Text style={styles.signatureValue}>{name}</Text>
            ) : (
              <View style={styles.signatureLine} />
            )}
          </View>
          <View style={styles.signatureField}>
            <Text style={styles.signatureLabel}>Date:</Text>
            {date ? (
              <Text style={styles.signatureValue}>{date}</Text>
            ) : (
              <View style={styles.signatureLine} />
            )}
          </View>
        </View>

        <View style={{ marginTop: 12 }}>
          <Text style={styles.signatureLabel}>Position:</Text>
          {position ? (
            <Text style={styles.signatureValue}>{position}</Text>
          ) : (
            <View style={styles.signatureLine} />
          )}
        </View>

        <View style={styles.footer}>
          <Text style={styles.footerHighlight}>For Healthier, Happier Communities</Text>
          <Text>2/F Diwang Tariac, Romulo Blvd, San Vicente, Tariac City 2300</Text>
          <Text>Webpage: http://wah.ph/ | Email Address: wah.pilipinas@gmail.com</Text>
          <Text>Contacts: Landline-045-985-5607 / Smart-09985651432 / Globe-09175229170</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ExitInterviewForm;