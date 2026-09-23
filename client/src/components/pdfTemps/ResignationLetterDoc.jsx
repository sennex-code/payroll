import React from "react";
import { Document, Page, Text, StyleSheet, View } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    backgroundColor: "white",
    fontFamily: "Times-Roman",
    fontSize: 11,
    paddingTop: 56,
    paddingBottom: 56,
    paddingLeft: 60,
    paddingRight: 60,
    lineHeight: 1.55,
  },
  date: {
    textAlign: "right",
    marginBottom: 24,
  },
  recipientBlock: {
    marginBottom: 20,
  },
  subject: {
    marginBottom: 14,
    fontWeight: 700,
  },
  paragraph: {
    marginBottom: 12,
    textAlign: "justify",
  },
  signatureBlock: {
    marginTop: 28,
  },
  line: {
    borderBottomWidth: 1,
    borderBottomColor: "#222",
    width: 220,
    marginTop: 20,
    marginBottom: 6,
  },
  muted: {
    color: "#444",
  },
});

const formatReadableDate = (value) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const ResignationLetterDoc = ({
  employeeName = "",
  recipientName = "",
  resignationDate = "",
  lastWorkingDay = "",
  letterBody = "",
  position = "",
}) => {
  const resolvedDate =
    formatReadableDate(resignationDate) || formatReadableDate(lastWorkingDay);

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.date}>{resolvedDate}</Text>

        <View style={styles.recipientBlock}>
          <Text>{recipientName || "To Whom It May Concern"}</Text>
        </View>

        <Text style={styles.subject}>Subject: Resignation Letter</Text>

        <Text style={styles.paragraph}>
          Dear {recipientName || "Sir/Madam"},
        </Text>

        <Text style={styles.paragraph}>
          {letterBody ||
            "Please accept this letter as formal notice of my resignation from my current role."}
        </Text>

        {lastWorkingDay ? (
          <Text style={styles.paragraph}>
            My final working day will be {formatReadableDate(lastWorkingDay)}.
          </Text>
        ) : null}

        <Text style={styles.paragraph}>
          Thank you for the guidance and opportunities extended to me during my
          employment.
        </Text>

        <Text style={styles.paragraph}>Sincerely,</Text>

        <View style={styles.signatureBlock}>
          <View style={styles.line} />
          <Text>{employeeName}</Text>
          <Text style={styles.muted}>{position}</Text>
        </View>
      </Page>
    </Document>
  );
};

export default ResignationLetterDoc;
