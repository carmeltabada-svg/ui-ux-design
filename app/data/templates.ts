// Real content sourced from the original prototype's TEMPLATES / TEMPLATE_GROUPS /
// TOKEN_GROUPS / VERSION_HISTORY JS objects (template_decoded.html, ~line 13871-14039).

export interface EmailTemplate {
  name: string
  mode: 'onsite' | 'remote'
  when: string
  attachment: string
  /**
   * Id into RETRIEVAL_FORMS (app/data/retrievalForms.ts). Every template with a
   * real attachment currently resolves to the one form sourced so far
   * ('aof-commitment') - more real forms are pending from the user.
   */
  attachmentFormId?: string
  subject: string
  body: string
}

export const TEMPLATES: Record<string, EmailTemplate> = {
  t1: { name: 'Resignation', mode: 'onsite', when: 'Sent when a resigning team member returns equipment onsite', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-onsite', subject: 'Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>As you have tendered your resignation from GoTeam effective {{LAST_WORKING_DAY}}, GoTeam is writing to initiate the equipment return process as part of your clearance.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>GoTeam requires you to return the above equipment on or before the end of your last shift on {{LAST_WORKING_DAY}} at:</p><blockquote><p>Asset Management Team<br>9th Floor, i1 Building, Jose Maria del Mar St.<br>IT Park, Apas, Cebu City 6000</p></blockquote><p>Please coordinate your turnover in advance with the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}. Ensure all items are complete upon handover, including the device, charger, and accompanying accessories. A condition check will be conducted at the time of turnover and a receipt will be issued to you.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including the target date you intend to turn the equipment over. The link closes on that date, which falls before your turnover deadline. Signing confirms that you have received this retrieval instruction and that you commit to returning the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> The Asset Management Team's clearance sign-off is contingent upon the full return of all GoTeam and client-issued equipment in your possession. Should the equipment not be returned within the period stated in this notice, the Asset Management Team will withhold its clearance sign-off and formally document the non-return as an open accountability in your asset record. Unreturned equipment is escalated internally for the appropriate action, which may include recovery of its assessed value through applicable legal or claims processes. Non-compliance with this notice will be treated as non-cooperation in the clearance process and formally documented as part of your separation record.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t2: { name: 'Resignation', mode: 'remote', when: 'Sent when a resigning team member ships equipment back', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-remote', subject: 'Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>As you have tendered your resignation from GoTeam effective {{LAST_WORKING_DAY}}, GoTeam is writing to initiate the equipment return process as part of your clearance.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>GoTeam requires you to ship the above equipment on or before {{TARGET_DISPATCH_DATE}} through one of GoTeam's prescribed courier providers. GoTeam maintains active corporate accounts with the following couriers:</p><ul><li><strong>JRS Express (Recommended)</strong> — Credit Account: Go Virtual Assistants Inc., Account No. 110604. Crating available.</li><li><strong>LBC</strong> — Account: Go Virtual Assistants, Inc., Account No. 10809702 (National Standard).</li></ul><p>Ship to: Go Virtual Assistants Inc. / GoTeam Asset Management, 9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000. {{ASSET_TEAM_MOBILE}} | {{ASSET_TEAM_EMAIL}}</p><div data-message-banner><p><strong>Action Required: Courier Branch Confirmation</strong></p><p>Before your shipment can be arranged, the Asset Management Team requires the specific courier branch you intend to use. Please open the acknowledgment linked below and complete the Return Commitment section within 1 business day, naming your preferred courier, the exact branch, and the complete branch address.</p><p>Upon submission, the Asset Management Team will coordinate with the courier's corporate account management team and issue a formal shipment authorization naming your confirmed branch. You will be copied on that communication. Please do not proceed to the branch until you have received your copy of the authorization.</p></div><p>Freight charges are billed directly to GoTeam's corporate account at the point of shipment — you will not be asked to pay at the counter. Once the shipment is completed and the actual cost is confirmed, the Asset Management Team endorses the corresponding amount to Payroll for processing where the cost is chargeable to you under GoTeam policy.</p><p><strong>Declared Value: {{DECLARED_VALUE}}.</strong> All shipments under GoTeam's corporate accounts are declared at this fixed amount. This declared value applies for shipping purposes only and does not represent GoTeam's valuation of the equipment. GoTeam's right to recover the full assessed value of any unreturned or damaged equipment remains independent of and unaffected by this declared shipping value. Any additional charges arising from non-compliance with this instruction will be for your account. Please send your tracking number to {{ASSET_TEAM_EMAIL}} on the day of dispatch.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including your courier of choice and the exact branch you will lodge at. The link closes on that date, which falls before your dispatch deadline. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> The Asset Management Team's clearance sign-off is contingent upon the full return of all GoTeam and client-issued equipment in your possession. Should the equipment not be returned within the period stated in this notice, the Asset Management Team will withhold its clearance sign-off and formally document the non-return as an open accountability in your asset record. Unreturned equipment is escalated internally for the appropriate action, which may include recovery of its assessed value through applicable legal or claims processes. Non-compliance with this notice will be treated as non-cooperation in the clearance process and formally documented as part of your separation record.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t3: { name: 'Immediate Resignation', mode: 'onsite', when: 'Sent when a team member resigns effective immediately, onsite', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-onsite', subject: 'Urgent: Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>Following your resignation notice dated {{NOTICE_DATE}}, GoTeam is writing to formally request the immediate return of all equipment assigned to your account.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>Given the immediate effectivity of your separation, the equipment must be returned at the earliest point of access. If you are on site, turnover is to be completed before the end of your shift today. If you are within the service range but not on site, please coordinate your turnover immediately, and in no case later than the next working day. Turnover is at:</p><blockquote><p>Asset Management Team<br>9th Floor, i1 Building, Jose Maria del Mar St.<br>IT Park, Apas, Cebu City 6000</p></blockquote><p>Please coordinate your turnover immediately with the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}. Ensure all items are complete upon handover, including the device, charger, and accompanying accessories. A condition check will be conducted at the time of turnover and a receipt will be issued to you.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including the target date you intend to turn the equipment over. The link closes on that date, which falls before your turnover deadline. Signing confirms that you have received this retrieval instruction and that you commit to returning the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> The Asset Management Team's clearance sign-off is contingent upon the full return of all GoTeam and client-issued equipment in your possession. Should the equipment not be returned within the period stated in this notice, the Asset Management Team will withhold its clearance sign-off and formally document the non-return as an open accountability in your asset record. Unreturned equipment is escalated internally for the appropriate action, which may include recovery of its assessed value through applicable legal or claims processes. Non-compliance with this notice will be treated as non-cooperation in the clearance process and formally documented as part of your separation record.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t4: { name: 'Immediate Resignation', mode: 'remote', when: 'Sent when a team member resigns effective immediately, remote', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-remote', subject: 'Urgent: Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>Following your resignation notice dated {{NOTICE_DATE}}, GoTeam is writing to formally request the immediate return of all equipment assigned to your account.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>Given the immediate effectivity of your separation, the equipment must be dispatched at the earliest opportunity, and in no case later than {{TARGET_DISPATCH_DATE}}. Returns not dispatched within this period are escalated. Shipment is through one of GoTeam's prescribed courier providers. GoTeam maintains active corporate accounts with the following couriers:</p><ul><li><strong>JRS Express (Recommended)</strong> — Credit Account: Go Virtual Assistants Inc., Account No. 110604. Crating available.</li><li><strong>LBC</strong> — Account: Go Virtual Assistants, Inc., Account No. 10809702 (National Standard).</li></ul><p>Ship to: Go Virtual Assistants Inc. / GoTeam Asset Management, 9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000. {{ASSET_TEAM_MOBILE}} | {{ASSET_TEAM_EMAIL}}</p><div data-message-banner><p><strong>Action Required: Courier Branch Confirmation</strong></p><p>Before your shipment can be arranged, the Asset Management Team requires the specific courier branch you intend to use. Please open the acknowledgment linked below and complete the Return Commitment section within 1 business day, naming your preferred courier, the exact branch, and the complete branch address.</p><p>Upon submission, the Asset Management Team will coordinate with the courier's corporate account management team and issue a formal shipment authorization naming your confirmed branch. You will be copied on that communication. Please do not proceed to the branch until you have received your copy of the authorization.</p></div><p>Freight charges are billed directly to GoTeam's corporate account at the point of shipment — you will not be asked to pay at the counter. Once the shipment is completed and the actual cost is confirmed, the Asset Management Team endorses the corresponding amount to Payroll for processing where the cost is chargeable to you under GoTeam policy.</p><p><strong>Declared Value: {{DECLARED_VALUE}}.</strong> All shipments under GoTeam's corporate accounts are declared at this fixed amount. This declared value applies for shipping purposes only and does not represent GoTeam's valuation of the equipment. GoTeam's right to recover the full assessed value of any unreturned or damaged equipment remains independent of and unaffected by this declared shipping value. Any additional charges arising from non-compliance with this instruction will be for your account. Please send your tracking number to {{ASSET_TEAM_EMAIL}} on the day of dispatch.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including your courier of choice and the exact branch you will lodge at. The link closes on that date, which falls before your dispatch deadline. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> The Asset Management Team's clearance sign-off is contingent upon the full return of all GoTeam and client-issued equipment in your possession. Should the equipment not be returned within the period stated in this notice, the Asset Management Team will withhold its clearance sign-off and formally document the non-return as an open accountability in your asset record. Unreturned equipment is escalated internally for the appropriate action, which may include recovery of its assessed value through applicable legal or claims processes. Non-compliance with this notice will be treated as non-cooperation in the clearance process and formally documented as part of your separation record.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam\n{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t5: { name: 'End of Contract', mode: 'onsite', when: 'Sent when a fixed-term contract ends, onsite', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-onsite', subject: 'Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>The Asset Management Team has received notice of a change in your employment status effective {{LAST_WORKING_DAY}} and is proceeding with the equipment return process in accordance with standard asset management procedures. This is a required step as part of your clearance.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>GoTeam requires you to return the above equipment on or before the end of your last shift on {{LAST_WORKING_DAY}} at:</p><blockquote><p>Asset Management Team<br>9th Floor, i1 Building, Jose Maria del Mar St.<br>IT Park, Apas, Cebu City 6000</p></blockquote><p>Please coordinate your turnover in advance with the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}. Ensure all items are complete upon handover, including the device, charger, and accompanying accessories. A condition check will be conducted at the time of turnover and a receipt will be issued to you.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including the target date you intend to turn the equipment over. The link closes on that date, which falls before your turnover deadline. Signing confirms that you have received this retrieval instruction and that you commit to returning the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> The return of all GoTeam and client-issued equipment is a standard and required step at the conclusion of your contract. The Asset Management Team's clearance sign-off is contingent upon the full return of all equipment in your possession. Should the equipment not be returned within the period stated in this notice, the Asset Management Team will withhold its clearance sign-off and formally document the non-return as part of your separation record. Unreturned equipment is escalated internally for the appropriate action, which may include recovery of its assessed value through applicable legal or claims processes. GoTeam is committed to completing your separation in good order, and your cooperation with this step supports that outcome for both parties.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t6: { name: 'End of Contract', mode: 'remote', when: 'Sent when a fixed-term contract ends, remote', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-remote', subject: 'Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>The Asset Management Team has received notice of a change in your employment status effective {{LAST_WORKING_DAY}} and is proceeding with the equipment return process in accordance with standard asset management procedures. This is a required step as part of your clearance.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>GoTeam requires you to ship the above equipment on or before {{TARGET_DISPATCH_DATE}} through one of GoTeam's prescribed courier providers. GoTeam maintains active corporate accounts with the following couriers:</p><ul><li><strong>JRS Express (Recommended)</strong> — Credit Account: Go Virtual Assistants Inc., Account No. 110604. Crating available.</li><li><strong>LBC</strong> — Account: Go Virtual Assistants, Inc., Account No. 10809702 (National Standard).</li></ul><p>Ship to: Go Virtual Assistants Inc. / GoTeam Asset Management, 9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000. {{ASSET_TEAM_MOBILE}} | {{ASSET_TEAM_EMAIL}}</p><div data-message-banner><p><strong>Action Required: Courier Branch Confirmation</strong></p><p>Before your shipment can be arranged, the Asset Management Team requires the specific courier branch you intend to use. Please open the acknowledgment linked below and complete the Return Commitment section within 1 business day, naming your preferred courier, the exact branch, and the complete branch address.</p><p>Upon submission, the Asset Management Team will coordinate with the courier's corporate account management team and issue a formal shipment authorization naming your confirmed branch. You will be copied on that communication. Please do not proceed to the branch until you have received your copy of the authorization.</p></div><p>Freight charges will be billed directly to GoTeam's corporate account — you will not be asked to shoulder any shipping cost.</p><p><strong>Declared Value: {{DECLARED_VALUE}}.</strong> All shipments under GoTeam's corporate accounts are declared at this fixed amount. This declared value applies for shipping purposes only and does not represent GoTeam's valuation of the equipment. GoTeam's right to recover the full assessed value of any unreturned or damaged equipment remains independent of and unaffected by this declared shipping value. Any additional charges arising from non-compliance with this instruction will be for your account. Please send your tracking number to {{ASSET_TEAM_EMAIL}} on the day of dispatch.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including your courier of choice and the exact branch you will lodge at. The link closes on that date, which falls before your dispatch deadline. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> The return of all GoTeam and client-issued equipment is a standard and required step at the conclusion of your contract. The Asset Management Team's clearance sign-off is contingent upon the full return of all equipment in your possession. Should the equipment not be returned within the period stated in this notice, the Asset Management Team will withhold its clearance sign-off and formally document the non-return as part of your separation record. Unreturned equipment is escalated internally for the appropriate action, which may include recovery of its assessed value through applicable legal or claims processes. GoTeam is committed to completing your separation in good order, and your cooperation with this step supports that outcome for both parties.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t9: { name: 'Recalled', mode: 'onsite', when: 'Sent when a team member is recalled from deployment, onsite', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-onsite', subject: 'Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>The Asset Management Team has received notice of a change in your employment status effective {{RECALL_EFFECTIVE_DATE}} and is proceeding with the equipment return process in accordance with standard asset management procedures. This is a routine step in the management of your account during this period.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody until your next placement is confirmed. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>GoTeam requires you to return the above equipment on or before {{TARGET_RETURN_DATE}} at:</p><blockquote><p>Asset Management Team<br>9th Floor, i1 Building, Jose Maria del Mar St.<br>IT Park, Apas, Cebu City 6000</p></blockquote><p>Please coordinate your turnover with the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}. Ensure all items are complete upon handover, including the device, charger, and accompanying accessories. A condition check will be conducted at the time of turnover and a receipt will be issued to you.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including the target date you intend to turn the equipment over. The link closes on that date, which falls before your turnover deadline. Signing confirms that you have received this retrieval instruction and that you commit to returning the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> As part of the Asset Management Team's standard equipment management process, all company and client-issued equipment is required to be returned to GoTeam's custody in accordance with this notice. The Asset Management Team will coordinate all retrieval logistics on your behalf. Should the equipment not be returned within the period specified in this notice, GoTeam reserves the right to place a hold on your account and formally note the outstanding return on your employment record.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t10: { name: 'Recalled', mode: 'remote', when: 'Sent when a team member is recalled from deployment, remote', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-remote', subject: 'Equipment Return Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>The Asset Management Team has received notice of a change in your employment status effective {{RECALL_EFFECTIVE_DATE}} and is proceeding with the equipment return process in accordance with standard asset management procedures. This is a routine step in the management of your account during this period.</p><p>In accordance with GoTeam's Asset Management Policy, all company and client-issued equipment must be returned to GoTeam's custody until your next placement is confirmed. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>GoTeam requires you to ship the above equipment on or before {{TARGET_DISPATCH_DATE}} through one of GoTeam's prescribed courier providers. GoTeam maintains active corporate accounts with the following couriers:</p><ul><li><strong>JRS Express (Recommended)</strong> — Credit Account: Go Virtual Assistants Inc., Account No. 110604. Crating available.</li><li><strong>LBC</strong> — Account: Go Virtual Assistants, Inc., Account No. 10809702 (National Standard).</li></ul><p>Ship to: Go Virtual Assistants Inc. / GoTeam Asset Management, 9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000. {{ASSET_TEAM_MOBILE}} | {{ASSET_TEAM_EMAIL}}</p><div data-message-banner><p><strong>Action Required: Courier Branch Confirmation</strong></p><p>Before your shipment can be arranged, the Asset Management Team requires the specific courier branch you intend to use. Please open the acknowledgment linked below and complete the Return Commitment section within 1 business day, naming your preferred courier, the exact branch, and the complete branch address.</p><p>Upon submission, the Asset Management Team will coordinate with the courier's corporate account management team and issue a formal shipment authorization naming your confirmed branch. You will be copied on that communication. Please do not proceed to the branch until you have received your copy of the authorization.</p></div><p>Freight charges will be billed directly to GoTeam's corporate account — you will not be asked to shoulder any shipping cost.</p><p><strong>Declared Value: {{DECLARED_VALUE}}.</strong> All shipments under GoTeam's corporate accounts are declared at this fixed amount. This declared value applies for shipping purposes only and does not represent GoTeam's valuation of the equipment. GoTeam's right to recover the full assessed value of any unreturned or damaged equipment remains independent of and unaffected by this declared shipping value. Any additional charges arising from non-compliance with this instruction will be for your account. Please send your tracking number to {{ASSET_TEAM_EMAIL}} on the day of dispatch.</p><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including your courier of choice and the exact branch you will lodge at. The link closes on that date, which falls before your dispatch deadline. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> As part of the Asset Management Team's standard equipment management process, all company and client-issued equipment is required to be returned to GoTeam's custody in accordance with this notice. The Asset Management Team will coordinate all retrieval logistics on your behalf. Should the equipment not be returned within the period specified in this notice, GoTeam reserves the right to place a hold on your account and formally note the outstanding return on your employment record.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t11: { name: 'Unexplained Absence', mode: 'remote', when: 'Sent after P&C termination endorsement on an unexplained absence case', attachment: 'Equipment Return Acknowledgment Form', attachmentFormId: 'return-ack-remote', subject: 'Equipment Security Notice | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>GoTeam is writing to formally request the return of the following company and client-issued equipment currently assigned to your account.</p><p>Pursuant to GoTeam's information security policy, all company and client-issued equipment must be returned to GoTeam's custody without delay. The following equipment is currently assigned to your account:</p><table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td></tr></table><p>GoTeam requires you to ship the above equipment on or before {{TARGET_DISPATCH_DATE}} through one of GoTeam's prescribed courier providers. GoTeam maintains active corporate accounts with the following couriers:</p><ul><li><strong>JRS Express (Recommended)</strong> — Credit Account: Go Virtual Assistants Inc., Account No. 110604. Crating available.</li><li><strong>LBC</strong> — Account: Go Virtual Assistants, Inc., Account No. 10809702 (National Standard).</li></ul><p>Ship to: Go Virtual Assistants Inc. / GoTeam Asset Management, 9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000. {{ASSET_TEAM_MOBILE}} | {{ASSET_TEAM_EMAIL}}</p><div data-message-banner><p><strong>Action Required: Courier Branch Confirmation</strong></p><p>Before your shipment can be arranged, the Asset Management Team requires the specific courier branch you intend to use. Please open the acknowledgment linked below and complete the Return Commitment section within 1 business day, naming your preferred courier, the exact branch, and the complete branch address.</p><p>Upon submission, the Asset Management Team will coordinate with the courier's corporate account management team and issue a formal shipment authorization naming your confirmed branch. You will be copied on that communication. Please do not proceed to the branch until you have received your copy of the authorization.</p></div><p>Freight charges will be billed directly to GoTeam's corporate account — you will not be asked to shoulder any shipping cost.</p><p><strong>Declared Value: {{DECLARED_VALUE}}.</strong> All shipments under GoTeam's corporate accounts are declared at this fixed amount. This declared value applies for shipping purposes only and does not represent GoTeam's valuation of the equipment. GoTeam's right to recover the full assessed value of any unreturned or damaged equipment remains independent of and unaffected by this declared shipping value. Any additional charges arising from non-compliance with this instruction will be for your account. Please send your tracking number to {{ASSET_TEAM_EMAIL}} on the day of dispatch.</p><div data-callout><p>Should GoTeam not receive confirmation of shipment by {{ESCALATION_DEADLINE}}, a courier collection will be arranged from your address on record.</p></div><p>Your Equipment Return Acknowledgment is at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}, including your courier of choice and the exact branch you will lodge at. The link closes on that date, which falls before your dispatch deadline. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above. It does not create the obligation to return the equipment, and declining to sign does not remove that obligation.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>GoTeam will rely on this notice as formal evidence that the return obligation has been communicated to you.</p><div data-callout><p><strong>Consequence of non-return:</strong> GoTeam will arrange and cover the cost of equipment retrieval to facilitate this process. If no response is received within the period specified in this notice, GoTeam will proceed with a scheduled courier collection from your address on record. Should the equipment not be recovered through these means, unreturned equipment is escalated internally for the appropriate action, which may include recovery of its assessed value through applicable legal or claims processes. This notice forms part of your formal employment record.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t12: { name: 'Midpoint Reminder', mode: 'onsite', when: 'Sent at the midpoint before the return deadline, onsite', attachment: 'none', subject: 'Reminder: Equipment Return Notice, Action Required | {{TM_FULL_NAME}} | Ref: {{APR_REF}}', body: "<p>Dear {{TM_FULL_NAME}},</p><p>This is a follow-up on the Equipment Return Notice issued to you on {{DATE_OF_ORIGINAL_NOTICE}}.</p><p>Your target return date is {{TARGET_RETURN_DATE}}, and we have yet to receive confirmation that arrangements have been made. Kindly review the instructions in the original notice and contact the Asset Team to confirm your return schedule at your earliest convenience.</p><p>Please ensure the following are ready for handover on or before {{TARGET_RETURN_DATE}}:</p><ul><li>The device and all accompanying accessories</li><li>Equipment in the condition noted at the time of issuance</li></ul><p>Your Equipment Return Acknowledgment is still open at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}. Signing confirms that you have received this retrieval instruction and that you commit to returning the equipment as set out above.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>To confirm your return schedule or for any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t13: { name: 'Midpoint Reminder', mode: 'remote', when: 'Sent at the midpoint before the dispatch deadline, remote', attachment: 'none', subject: 'Reminder: Equipment Return Notice, Action Required | {{TM_FULL_NAME}} | Ref: {{APR_REF}}', body: "<p>Dear {{TM_FULL_NAME}},</p><p>This is a follow-up on the Equipment Return Notice issued to you on {{DATE_OF_ORIGINAL_NOTICE}}.</p><p>Your target dispatch date is {{TARGET_DISPATCH_DATE}}, and we have yet to receive a shipment confirmation or tracking number. Kindly review the courier instructions in the original notice and proceed with dispatch at your earliest convenience.</p><p>Please ensure the following prior to dispatch:</p><ul><li>The device and all accompanying accessories are securely packed</li><li>The declared value meets the requirements stated in the original notice</li><li>Your tracking number is shared with the Asset Team once shipment is lodged</li></ul><p>Your Equipment Return Acknowledgment is still open at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>To submit your tracking number or for any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t14: { name: 'Final Reminder', mode: 'onsite', when: 'Sent as the final reminder before the return deadline, onsite', attachment: 'none', subject: 'FINAL REMINDER: Equipment Return Due {{TARGET_RETURN_DATE}} | {{TM_FULL_NAME}} | Ref: {{APR_REF}}', body: "<p>Dear {{TM_FULL_NAME}},</p><p>This is a final reminder that your equipment return is due on {{TARGET_RETURN_DATE}}.</p><p>As of {{DATE_OF_THIS_NOTICE}}, no return has been recorded by the GoTeam Asset Management Team. If no action is taken by your target return date, this matter will be referred to the HR and Payroll teams and formally documented as non-compliance in your employment record.</p><p>Your Equipment Return Acknowledgment is still open at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}. Signing confirms that you have received this retrieval instruction and that you commit to returning the equipment as set out above.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>Please contact the Asset Team immediately at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}} to confirm your return schedule.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t15: { name: 'Final Reminder', mode: 'remote', when: 'Sent as the final reminder before the dispatch deadline, remote', attachment: 'none', subject: 'FINAL REMINDER: Equipment Dispatch Due {{TARGET_DISPATCH_DATE}} | {{TM_FULL_NAME}} | Ref: {{APR_REF}}', body: "<p>Dear {{TM_FULL_NAME}},</p><p>This is a final reminder that your equipment dispatch is due on {{TARGET_DISPATCH_DATE}}.</p><p>As of {{DATE_OF_THIS_NOTICE}}, no shipment confirmation has been received by the GoTeam Asset Management Team. If no action is taken by your target dispatch date, this matter will be referred to the HR and Payroll teams and formally documented as non-compliance in your employment record.</p><p>Your Equipment Return Acknowledgment is still open at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>Please contact the Asset Team immediately at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}} to confirm your dispatch schedule or submit your tracking number.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t16: { name: 'Overdue Return Notice', mode: 'onsite', when: 'Sent when an onsite return has lapsed the deadline', attachment: 'none', subject: 'URGENT: Overdue Equipment Return, Action Required | {{TM_FULL_NAME}} | Ref: {{APR_REF}}', body: "<p>Dear {{TM_FULL_NAME}},</p><p>This notice is to formally advise you that your equipment return obligation remains outstanding as of {{DATE_OF_THIS_NOTICE}}.</p><p>An Equipment Return Notice was issued to you on {{DATE_OF_ORIGINAL_NOTICE}}, with a target return date of {{ORIGINAL_TARGET_DATE}}. As of today, no return has been recorded by the GoTeam Asset Management Team. This matter has been referred to the HR and Payroll teams for appropriate action in accordance with GoTeam's standard separation and clearance procedures.</p><div data-callout><p>Pursuant to GoTeam's Asset Management Policy, the GoTeam Employee Handbook, and the terms of your employment agreement, GoTeam reserves the right to withhold the Asset Management Team's clearance sign-off until all GoTeam and client-issued equipment has been returned in full, and to escalate the matter internally for the appropriate action, which may include recovery of the assessed value of any unreturned equipment through applicable legal or claims processes.</p></div><p>This non-compliance event is formally documented and forms part of your employment record.</p><p>Your Equipment Return Acknowledgment is still open at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}. Signing confirms that you have received this retrieval instruction and that you commit to returning the equipment as set out above.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t17: { name: 'Overdue Return Notice', mode: 'remote', when: 'Sent when a remote dispatch has lapsed the deadline', attachment: 'none', subject: 'URGENT: Overdue Equipment Return, Action Required | {{TM_FULL_NAME}} | Ref: {{APR_REF}}', body: "<p>Dear {{TM_FULL_NAME}},</p><p>This notice is to formally advise you that your equipment return obligation remains outstanding as of {{DATE_OF_THIS_NOTICE}}.</p><p>An Equipment Return Notice was issued to you on {{DATE_OF_ORIGINAL_NOTICE}}, with a target dispatch date of {{ORIGINAL_TARGET_DATE}}. As of today, no shipment confirmation has been received by the GoTeam Asset Management Team. This matter has been referred to the HR and Payroll teams for appropriate action in accordance with GoTeam's standard separation and clearance procedures.</p><div data-callout><p>Pursuant to GoTeam's Asset Management Policy, the GoTeam Employee Handbook, and the terms of your employment agreement, GoTeam reserves the right to withhold the Asset Management Team's clearance sign-off until all GoTeam and client-issued equipment has been returned in full, and to escalate the matter internally for the appropriate action, which may include recovery of the assessed value of any unreturned equipment through applicable legal or claims processes.</p></div><p>This non-compliance event is formally documented and forms part of your employment record.</p><p>Your Equipment Return Acknowledgment is still open at the link below. Please complete and sign it on or before {{ACKNOWLEDGMENT_DUE_DATE}}. Signing confirms that you have received this retrieval instruction and that you commit to shipping the equipment as set out above.</p><div data-message-banner><p><strong>Open your Equipment Return Acknowledgment</strong></p><p>{{ACKNOWLEDGMENT_LINK}}</p><p>This link closes on {{ACKNOWLEDGMENT_DUE_DATE}}. If it does not open, reply to this email and the Asset Management Team will assist.</p></div><p>For any questions, contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t18: { name: 'Courier Authorization', mode: 'remote', when: 'Sent to courier account manager to authorize the shipment', attachment: 'none', subject: 'Corporate Account Authorization for Equipment Return Shipment | {{TM_FULL_NAME}} | Ref: {{APR_REF}}', body: "<p>Dear {{ACCOUNT_MANAGER_NAME}},</p><p>GoTeam is endorsing a shipment for lodgement under our corporate account and requests your assistance in advising the receiving branch in advance.</p><div data-message-banner><p><strong>Authorized Shipper and Lodgement Branch</strong></p><p>Authorized Shipper: {{TM_FULL_NAME}} (Employee ID: {{EMPLOYEE_ID}})<br>Lodgement Branch: {{BRANCH_NAME}}<br>Branch Address: {{BRANCH_ADDRESS}}<br>Corporate Account No.: {{COURIER_ACCOUNT_NUMBER}}</p><p>Kindly advise the above branch that this shipper is authorized to lodge under GoTeam's corporate account, so that they may be accommodated without delay upon arrival.</p></div><p>Equipment authorized for shipment:</p><table><tr><th>Asset Name</th><th>Qty</th></tr><tr><td>{{ASSET_NAME}}</td><td>{{ASSET_QTY}}</td></tr></table><p>Shipment details — From: {{TM_PRESENT_ADDRESS}}. To: Asset Management Team, 9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000. Attention: GoTeam Asset Management Team.</p><p><strong>Declared Value: {{DECLARED_VALUE}}.</strong> All freight charges are to be billed to GoTeam's corporate account ({{COURIER_ACCOUNT_NAME}}).</p><p>For verification or any inquiries regarding this authorization, please contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{ASSET_TEAM_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  // T22-T25 - A11 Post-Retrieval Charging's 4-way outcome (see DeductionOutcome/DEDUCTION_OUTCOME_META in ticketTrackers.ts and the Post-Retrieval Charging alignment notes, the reference console this whole group is built from). Unlike T1-T18 (all "onsite"/"remote" by return mode), these four are mode-agnostic - the outcome depends on what came back damaged/missing, not how the ticket shipped - so `mode` is set to the ticket's own mode only where the console's own asset table shape genuinely differs (it doesn't here); kept as 'remote' for TEMPLATE_GROUPS filtering consistency with the rest of A11's Unexplained-Absence-only relevance, not because these can't fire on an onsite ticket - they can, and do, on any path once "Item Damaged or Not Returned" is picked.
  t22: { name: 'Assessment Complete, No Amount Charged', mode: 'remote', when: 'Sent when the assessment finds nothing chargeable (fair wear and tear), closes the matter outright, no form attached', attachment: 'none', subject: 'Assessment Complete, No Amount Charged | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>The equipment you returned was received on {{DATE_RECEIVED}} and assessed on {{DATE_ASSESSED}}. The assessment is complete.</p><p>No amount is charged to you. The assessment found nothing that carries a cost to you, and nothing will be deducted from your pay in connection with this equipment.</p><table><tr><th>Asset Tag</th><th>Serial Number</th><th>Asset Name</th><th>Condition on receipt</th></tr><tr><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td>{{ASSET_NAME}}</td><td>{{ASSET_CONDITION}}</td></tr></table><div data-callout><p><strong>This closes the equipment side of your record</strong></p><p>The items listed above are recorded as returned and accounted for. Your asset accountability for them is closed. Fair wear and tear over the period the equipment was with you is not a chargeable event, and no amount is recovered for it.</p></div><p>Thank you for returning the equipment. If you have any questions about this notice, reply to this email or contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{CASE_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t23: { name: 'Notice of Assessment, Repair Quotation Pending', mode: 'remote', when: 'Sent when damage is found but a repair quotation is not back yet, an interim notice, not an authority to deduct', attachment: 'Notice of Assessment, Repair Quotation Pending', attachmentFormId: 'notice-assessment-quotation-pending', subject: 'Notice of Assessment, Repair Quotation Pending | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>The equipment you returned was received on {{DATE_RECEIVED}} and assessed on {{DATE_ASSESSED}}. The assessment found damage that needs a repair quotation from the service provider before the cost can be established.</p><p>No amount is stated in this notice and nothing is being deducted. This notice tells you what was found and what happens next. It is not an authority to deduct and it is not a finding against you.</p><table><tr><th>Asset Tag</th><th>Serial Number</th><th>Asset Name</th><th>Condition found</th></tr><tr><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td>{{ASSET_NAME}}</td><td>{{ASSET_CONDITION}}</td></tr></table><p><strong>What happens next</strong></p><table><tr><th>Step</th><th>By when</th></tr><tr><td>The Asset Management Team requests a written repair quotation</td><td>In progress</td></tr><tr><td>You are written to with the outcome, whether or not a cost is put to you</td><td>{{QUOTATION_EXPECTED_BY}}</td></tr><tr><td>If a cost is proposed, you are given time to respond before anything is signed</td><td>{{RESPONSE_DUE_TM}}</td></tr></table><div data-callout><p><strong>Where you stand while the quotation is being obtained</strong></p><p>The equipment has been returned, so your return obligation is satisfied. This notice does not hold your clearance on its own. Fair wear and tear is never charged. Where a cost is proposed, it is limited to the repair cost actually quoted and incurred, and it is recovered only under a separate Authority to Deduct that you sign and that states the amount.</p></div><p>Attached is the Notice of Assessment for your record. You may ask to see the quotation and the assessment at any time. Reply to this email or contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{CASE_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t24: { name: 'Determination and Amount Payable', mode: 'remote', when: 'Sent once the quotation is back and a charge is proposed, the actual deduction authority', attachment: 'Authority to Deduct, Asset Loss/Damage/Non-Return', attachmentFormId: 'atd-loss-damage-non-return', subject: 'Determination and Amount Payable | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>This notice sets out the determination on the equipment covered by {{APR_REF}}, and the amount that follows from it.</p><table><tr><th>Asset Tag</th><th>Serial Number</th><th>Asset Name</th><th>Finding</th></tr><tr><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td>{{ASSET_NAME}}</td><td>{{ASSET_CONDITION}}</td></tr></table><p><strong>The amount</strong></p><table><tr><th>Basis of the amount</th><th>Supporting document</th><th>Amount</th></tr><tr><td>{{AMOUNT_BASIS}}</td><td>{{SUPPORTING_DOC_REF}}</td><td>PHP {{AMOUNT_FIGURES}}</td></tr></table><p>The amount above is the documented cost to the Company. It carries no penalty element, no handling charge and no uplift. Where the equipment is repairable, the amount is the repair cost actually quoted, not a replacement cost.</p><div data-callout><p><strong>Nothing is deducted until you sign</strong></p><p>Attached is the Authority to Deduct. No amount is taken from your pay unless you sign it. The authority covers only the amount stated above and no other amount.</p><p>If you do not agree with the finding or the amount, reply to this email by {{RESPONSE_DUE_TM}} with your account of it. Your response is recorded and considered before anything further is done, and your right to raise it through GoTeam's established channels is not affected by this notice.</p></div><p>The determination and the documents it rests on are furnished with this notice and are available to you on request. Reply to this email or contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{CASE_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
  t25: { name: 'Settlement of Equipment Accountability', mode: 'remote', when: "Sent when the team member elects to keep the equipment and pay for it instead of returning it, an ownership transfer, not a damage finding", attachment: 'Authority to Deduct, Asset Settlement and Transfer', attachmentFormId: 'atd-settlement-transfer', subject: 'Settlement of Equipment Accountability | {{TM_FULL_NAME}} | {{APR_REF}}', body: "<p>Dear {{TM_FIRST_NAME}},</p><p>The Asset Management Team confirms your message of {{DATE_BUYOUT_ELECTION}}, in which you told us you are not able to return the equipment covered by {{APR_REF}} and would rather settle it and keep it.</p><p>That option is open to you, and it is your choice. GoTeam asked for the equipment back. Settling instead of returning is something we are offering, not something you are required to do. You may still return the equipment, and choosing to return it carries no consequence.</p><table><tr><th>Asset Tag</th><th>Serial Number</th><th>Asset Name</th><th>Settlement amount</th></tr><tr><td>{{ASSET_TAG}}</td><td>{{SERIAL_NUMBER}}</td><td>{{ASSET_NAME}}</td><td>{{ASSET_CONDITION}}</td></tr></table><p><strong>The amount</strong></p><table><tr><th>Basis of the amount</th><th>Supporting document</th><th>Amount</th></tr><tr><td>{{AMOUNT_BASIS}}</td><td>{{SUPPORTING_DOC_REF}}</td><td>PHP {{AMOUNT_FIGURES}}</td></tr></table><p>The settlement amount is the value of the equipment. It is not a penalty and it is not a finding against you. It carries no uplift and no handling charge.</p><div data-callout><p><strong>What signing does</strong></p><p>Attached is the Authority to Deduct, Asset Settlement and Transfer. Ownership of the equipment passes to you once the amount is recovered in full, and your obligation to return it ends at that point.</p><p>The equipment is settled as it stands, with no warranty and no further support from GoTeam or the client, and company and client software and accounts are removed from it. If you locate the equipment and decide to return it before recovery is complete, tell us and the deduction stops, with anything already deducted refunded.</p></div><p>Review the attached authority and reply by {{RESPONSE_DUE_TM}} with the signed copy if you wish to proceed. If you would rather return the equipment after all, say so in your reply and we will arrange it. Contact the Asset Team at {{ASSET_TEAM_EMAIL}} or {{ASSET_TEAM_MOBILE}}.</p><p>{{CASE_OFFICER}}<br>Asset Management Team | GoTeam<br>{{ASSET_TEAM_EMAIL}} | {{ASSET_TEAM_MOBILE}}</p>" },
}

export const TEMPLATE_GROUPS: { label: string; keys: string[] }[] = [
  { label: 'Return Notices - Resignation', keys: ['t1', 't2', 't3', 't4'] },
  { label: 'Return Notices - End of Contract', keys: ['t5', 't6'] },
  { label: 'Return Notices - Recalled', keys: ['t9', 't10'] },
  { label: 'Return Notices - Unexplained Absence', keys: ['t11'] },
  { label: 'Reminders and Overdue', keys: ['t12', 't13', 't14', 't15', 't16', 't17'] },
  { label: 'Courier', keys: ['t18'] },
  { label: 'Post-Retrieval Charging', keys: ['t22', 't23', 't24', 't25'] }
]

export const TOKEN_GROUPS: { label: string; tokens: { code: string; name: string }[] }[] = [
  { label: 'Custodian', tokens: [
    { code: 'TM_FULL_NAME', name: 'Team member full name' },
    { code: 'TM_FIRST_NAME', name: 'Team member first name' },
    { code: 'EMPLOYEE_ID', name: 'Employee ID' },
    { code: 'TM_EMAIL', name: 'GoTeam email' },
    { code: 'TM_CONTACT_NUMBER', name: 'Contact number' },
    { code: 'TM_PRESENT_ADDRESS', name: 'Present address' },
    { code: 'CLIENT_NAME', name: 'Client name' },
    { code: 'LEADERSHIP_COACH', name: 'Leadership Coach' },
    { code: 'ALTERNATE_CONTACT_NAME', name: 'Alternate contact name' },
    { code: 'ALTERNATE_CONTACT_NUMBER', name: 'Alternate contact number' }
  ] },
  { label: 'Ticket', tokens: [
    { code: 'APR_REF', name: 'Ticket reference number' },
    { code: 'TICKET_CREATED_DATE', name: 'Ticket created date' },
    { code: 'RETRIEVAL_REASON', name: 'Retrieval reason' },
    { code: 'RETURN_MODE', name: 'Return mode' }
  ] },
  { label: 'Dates', tokens: [
    { code: 'TARGET_RETURN_DATE', name: 'Target return date' },
    { code: 'TARGET_DISPATCH_DATE', name: 'Target dispatch date' },
    { code: 'LAST_WORKING_DAY', name: 'Last working day' },
    { code: 'SEPARATION_DATE', name: 'Separation date' },
    { code: 'NOTICE_DATE', name: 'Notice date' },
    { code: 'DATE_OF_THIS_NOTICE', name: 'Date this notice was sent' },
    { code: 'LEAVE_START_DATE', name: 'Leave start date' },
    { code: 'RECALL_EFFECTIVE_DATE', name: 'Recall effective date' },
    { code: 'DATE_OF_ORIGINAL_NOTICE', name: 'Date the original return/dispatch notice was sent' },
    { code: 'DAYS_OVERDUE', name: 'Days overdue' },
    { code: 'ORIGINAL_TARGET_DATE', name: 'Original return or dispatch deadline' },
    { code: 'ACKNOWLEDGMENT_DUE_DATE', name: 'Acknowledgment form due date' },
    { code: 'ESCALATION_DEADLINE', name: 'Escalation deadline' }
  ] },
  { label: 'Assets', tokens: [
    { code: 'ASSET_NAME', name: 'Asset name' },
    { code: 'ASSET_TAG', name: 'Asset tag' },
    { code: 'SERIAL_NUMBER', name: 'Serial number' },
    { code: 'ASSET_QTY', name: 'Quantity' },
    { code: 'ASSET_TABLE', name: 'Asset table, one row per confirmed asset (name, tag, serial)' },
    { code: 'ASSET_TABLE_QTY', name: 'Asset table with name and quantity only (courier endorsement, no serial numbers)' }
  ] },
  { label: 'Courier', tokens: [
    { code: 'COURIER_NAME', name: 'Courier name' },
    { code: 'COURIER_ACCOUNT_NAME', name: 'Corporate account name' },
    { code: 'COURIER_ACCOUNT_NUMBER', name: 'Corporate account number' },
    { code: 'ACCOUNT_MANAGER_NAME', name: 'Account manager name' },
    { code: 'ACCOUNT_MANAGER_EMAIL', name: 'Account manager email' },
    { code: 'BRANCH_NAME', name: 'Confirmed branch name' },
    { code: 'BRANCH_ADDRESS', name: 'Confirmed branch address' },
    { code: 'DECLARED_VALUE', name: 'Declared value - fixed system constant, PHP 5,000.00 for all shipments' },
    { code: 'TRACKING_NUMBER', name: 'Tracking or reference number' }
  ] },
  { label: 'Asset Team', tokens: [
    { code: 'ASSET_TEAM_NAME', name: 'Asset Team name' },
    { code: 'ASSET_TEAM_ADDRESS', name: 'Asset Team address' },
    { code: 'ASSET_TEAM_MOBILE', name: 'Asset Team mobile' },
    { code: 'ASSET_TEAM_LANDLINE', name: 'Asset Team landline' },
    { code: 'ASSET_TEAM_EMAIL', name: 'Asset Team email' },
    { code: 'ASSET_TEAM_SCHEDULE', name: 'Asset Team schedule' },
    { code: 'ASSET_TEAM_OFFICER', name: 'Signing officer name and title' }
  ] },
  { label: 'Links', tokens: [
    { code: 'ACKNOWLEDGMENT_LINK', name: 'Acknowledgment form link' },
    { code: 'TRACKING_LINK', name: 'Shipment tracking link' }
  ] },
  /** A11 Post-Retrieval Charging (T22-T25/F1-F3) - sourced from Case Details Steps 2-4 (see ticketTrackers.ts's own Ticket.deductionCase* fields and DEDUCTION_AMOUNT_BASIS_LABELS) plus the ticket-wide atdReference/assetOwnerInfo. See the Post-Retrieval Charging alignment notes for the reference console this group is built from. */
  { label: 'Post-Retrieval Charging', tokens: [
    { code: 'CASE_OFFICER', name: 'Asset Team officer for this case' },
    { code: 'ATD_REFERENCE', name: 'ATD reference number' },
    { code: 'ASSET_OWNER', name: 'Asset owner - GoTeam or the client' },
    { code: 'DATE_RETURN_REQUESTED', name: 'Date the return was requested' },
    { code: 'DATE_RECEIVED', name: 'Date the equipment was received' },
    { code: 'DATE_ASSESSED', name: 'Date the equipment was assessed' },
    { code: 'DATE_BUYOUT_ELECTION', name: 'Date of buy-out election' },
    { code: 'QUOTATION_EXPECTED_BY', name: 'Date the repair quotation is expected' },
    { code: 'HEAR_BACK_BY', name: 'Date the team member will hear back by' },
    { code: 'RESPONSE_DUE_TM', name: 'Date a response is due from the team member' },
    { code: 'AMOUNT_BASIS', name: 'Basis of the charged/settlement amount' },
    { code: 'SUPPORTING_DOC_REF', name: 'Supporting document reference' },
    { code: 'AMOUNT_FIGURES', name: 'Amount in figures' },
    { code: 'AMOUNT_WORDS', name: 'Amount in words' },
    { code: 'ASSET_CONDITION', name: 'Condition, finding or settlement amount per item' }
  ] }
]

/**
 * FR-003.6 A7 ("Call confirmation ... SMS after an unanswered attempt") and
 * FR-003.12 ("SMS-1A to SMS-11 ... Copy-paste only. No gateway integration
 * required. Presented in a sidebar box ... a manual sent-confirmation
 * control"). The real submission ships 11 numbered SMS templates (one per
 * retrieval path) alongside their email counterparts - not included in this
 * codebase - so this is the one generic follow-up text A7's own escalation
 * step needs: a short, copy-paste SMS sent once 3 call attempts have gone
 * unanswered, using the same {{TOKEN}} placeholders as every email template.
 */
export const CALL_ESCALATION_SMS_TEMPLATE = "GoTeam Asset Mgmt: Hi {{TM_FIRST_NAME}}, we've tried calling you 3 times re: your equipment return (Ref {{APR_REF}}) with no answer. Please check your email for the retrieval notice and call us back at {{ASSET_TEAM_MOBILE}} at your earliest convenience."

// Real version history recorded against t16 (Overdue Return Notice · Onsite) in the source.
export const VERSION_HISTORY_T16 = [
  { id: 'v2', label: 'Wording corrected', actor: 'Geraldene de la Torre', date: 'Aug 18, 2026, 2:41 PM' },
  { id: 'v1', label: 'Created from spec', actor: 'System', date: 'Aug 7, 2026, 4:15 PM' }
]

// code -> name lookup, mirrors the source's TOKEN_INFO built from TOKEN_GROUPS.forEach(...)
export const TOKEN_INFO: Record<string, string> = Object.fromEntries(
  TOKEN_GROUPS.flatMap(g => g.tokens.map(t => [t.code, t.name]))
)

// The legal-entity address line printed under the logo in a retrieval
// form's header - copied verbatim from the reference mockup
// (GoTeam_Asset_Receiving_Commitment_Form_Mockup_v1.html's `ADDR` constant),
// not derived from SAMPLE_VALUES.ASSET_TEAM_ADDRESS (that one's the shorter
// "where to return equipment" line used inside email bodies, missing the
// entity name, the "Apas" barangay, and the zip code this one has).
export const GOTEAM_ENTITY_ADDRESS = 'Go Virtual Assistants Inc.  |  9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Apas, Cebu City 6000'

// Realistic sample values used to preview what a filled-in email looks like,
// standing in for the source's SAMPLE_SETS/COURIER_PROVIDERS (extracted but not wired).
export const SAMPLE_VALUES: Record<string, string> = {
  TM_FULL_NAME: 'Juan Miguel Dela Cruz',
  TM_FIRST_NAME: 'Juan',
  EMPLOYEE_ID: 'GT-00482',
  TM_EMAIL: 'juan.delacruz@go.team',
  TM_CONTACT_NUMBER: '+63 917 123 4567',
  TM_PRESENT_ADDRESS: '145 Salinas Drive, Lahug, Cebu City',
  CLIENT_NAME: 'Wave Contact Center',
  LEADERSHIP_COACH: 'Ana Reyes',
  ALTERNATE_CONTACT_NAME: 'Maria Dela Cruz',
  ALTERNATE_CONTACT_NUMBER: '+63 917 765 4321',
  APR_REF: 'APR-2026-04821',
  TICKET_CREATED_DATE: 'Aug 4, 2026',
  RETRIEVAL_REASON: 'Resignation',
  RETURN_MODE: 'Onsite',
  TARGET_RETURN_DATE: 'Aug 20, 2026',
  TARGET_DISPATCH_DATE: 'Aug 20, 2026',
  LAST_WORKING_DAY: 'Aug 19, 2026',
  SEPARATION_DATE: 'Aug 19, 2026',
  NOTICE_DATE: 'Aug 5, 2026',
  DATE_OF_THIS_NOTICE: 'Aug 27, 2026',
  DATE_OF_ORIGINAL_NOTICE: 'Aug 13, 2026',
  LEAVE_START_DATE: 'Aug 6, 2026',
  RECALL_EFFECTIVE_DATE: 'Aug 12, 2026',
  DAYS_OVERDUE: '7',
  ORIGINAL_TARGET_DATE: 'Aug 20, 2026',
  ACKNOWLEDGMENT_DUE_DATE: 'Aug 22, 2026',
  ESCALATION_DEADLINE: 'Aug 29, 2026',
  ASSET_NAME: 'Lenovo ThinkPad T14',
  ASSET_TAG: 'GT-LTP-1116',
  SERIAL_NUMBER: 'PF3KX9J2',
  ASSET_QTY: '1',
  ASSET_TABLE: '1x Lenovo ThinkPad T14 (Tag: GT-LTP-1116, Serial: PF3KX9J2)',
  ASSET_TABLE_QTY: '1x Lenovo ThinkPad T14',
  COURIER_NAME: 'LBC Express',
  COURIER_ACCOUNT_NAME: 'Go Virtual Assistants Inc.',
  COURIER_ACCOUNT_NUMBER: '0192-8834-01',
  ACCOUNT_MANAGER_NAME: 'Realyn Buot',
  ACCOUNT_MANAGER_EMAIL: 'realyn.buot@lbcexpress.com',
  BRANCH_NAME: 'LBC IT Park Branch',
  BRANCH_ADDRESS: 'Rockwell Business Center, IT Park, Cebu City',
  DECLARED_VALUE: 'PHP 5,000.00',
  TRACKING_NUMBER: 'LBC-88213904',
  ASSET_TEAM_NAME: 'Asset Management Team',
  ASSET_TEAM_ADDRESS: '9th Floor, i1 Building, Jose Maria del Mar St., IT Park, Cebu City',
  ASSET_TEAM_MOBILE: '+63 917 000 1234',
  ASSET_TEAM_LANDLINE: '(032) 000 1234',
  ASSET_TEAM_EMAIL: 'itasset@go.team',
  ASSET_TEAM_SCHEDULE: 'Mon to Fri, 9 AM to 6 PM',
  ASSET_TEAM_OFFICER: 'Geraldene de la Torre, Asset Management Lead',
  ACKNOWLEDGMENT_LINK: 'https://forms.go.team/acknowledgment/APR-2026-04821',
  TRACKING_LINK: 'https://lbcexpress.com/track/LBC-88213904',
  CASE_OFFICER: 'Geraldene de la Torre',
  ATD_REFERENCE: 'ATD-2026-0142',
  ASSET_OWNER: 'GoTeam',
  DATE_RETURN_REQUESTED: 'Aug 13, 2026',
  DATE_RECEIVED: 'Aug 22, 2026',
  DATE_ASSESSED: 'Aug 25, 2026',
  DATE_BUYOUT_ELECTION: 'Aug 26, 2026',
  QUOTATION_EXPECTED_BY: 'Sep 1, 2026',
  HEAR_BACK_BY: 'Sep 3, 2026',
  RESPONSE_DUE_TM: 'Sep 8, 2026',
  AMOUNT_BASIS: 'Documented repair quotation',
  SUPPORTING_DOC_REF: 'QUO-2026-0819',
  AMOUNT_FIGURES: 'PHP 5,400.00',
  AMOUNT_WORDS: 'Five Thousand Four Hundred Pesos Only',
  ASSET_CONDITION: 'Cracked display, lower left corner'
}

/**
 * Wraps every {{TOKEN}} occurrence in `html` with a highlightable span carrying
 * the token code (for click-to-sync highlighting) and data attributes driving a
 * custom two-line tooltip (name above, {{CODE}} below - see .tok-hl in main.css).
 * Pass `samples` (e.g. SAMPLE_VALUES) to render a realistic filled-in value
 * instead of the raw {{CODE}} text.
 */
export function wrapTokens(html: string, samples?: Record<string, string>, statusFor?: (code: string) => PlaceholderStatus): string {
  // Tags are matched whole, before text tokens, so a placeholder inside an
  // attribute (a plain link's href, or a button link's data-href) is filled
  // in right there. The tag itself carries the highlight, since a span can
  // not live inside an attribute.
  return html.replace(/(<[a-zA-Z][^<>]*>)|\{\{(\w+)\}\}/g, (match, tag: string | undefined, code: string) => {
    if (tag) return wrapAttributeTokens(tag, samples, statusFor)
    const name = TOKEN_INFO[code] || code
    // A substituted value is plain text, so it is escaped here: this string is rendered with v-html, and a team member name or a typed reference must never be able to inject markup.
    const display = samples && samples[code] !== undefined ? escapeText(samples[code]) : match
    const tip = samples ? ` data-tip-name="${name}" data-tip-code="${match}"` : ''
    // Optional per-ticket status modifier (retrieval workspace only - the
    // Templates/Master Data editors that also call wrapTokens() have no
    // ticket to check a code's real data against, so they never pass this
    // and every token there stays the plain default-blue .tok-hl).
    const statusClass = statusFor ? ` tok-hl--${statusFor(code)}` : ''
    return `<span class="tok-hl${statusClass}" data-token="${code}"${tip}>${display}</span>`
  })
}

const escapeAttr = (v: string) => v.replace(/&/g, '&amp;').replace(/"/g, '&quot;')
const escapeText = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/**
 * The tag-level half of wrapTokens: fills any {{TOKEN}} found in this tag's
 * attributes with its value (attribute-escaped) and marks the tag itself with
 * the same highlight class, data-token and tooltip a text token's span gets.
 */
function wrapAttributeTokens(tag: string, samples?: Record<string, string>, statusFor?: (code: string) => PlaceholderStatus): string {
  const codes = [...tag.matchAll(/\{\{(\w+)\}\}/g)].map(m => m[1] as string)
  if (!codes.length || !samples) return tag
  const first = codes[0]!
  let out = tag.replace(/\{\{(\w+)\}\}/g, (m, code: string) => escapeAttr(samples[code] ?? m))
  const cls = `tok-hl${statusFor ? ` tok-hl--${statusFor(first)}` : ''}`
  const extra = ` data-token="${first}" data-tip-name="${TOKEN_INFO[first] || first}" data-tip-code="&#123;&#123;${first}&#125;&#125;"`
  out = /\sclass="/.test(out)
    ? out.replace(/\sclass="([^"]*)"/, (_m, c: string) => ` class="${c} ${cls}"`)
    : out.replace(/\s*\/?>$/, m => ` class="${cls}"${m}`)
  return out.replace(/\s*\/?>$/, m => `${extra}${m}`)
}

/**
 * A genuinely final rendering of `{{TOKEN}}` occurrences - no highlight span,
 * no tooltip, just the resolved value (or, for a code with no sample value,
 * nothing at all). Unlike wrapTokens (which always keeps the raw `{{CODE}}`
 * text visible so an editor can spot/click it), this is for a document a
 * recipient actually reads or prints - the whole point is that they should
 * never see raw `{{CODE}}` placeholder syntax that never got filled in.
 */
export function resolveTokensForPrint(html: string, samples: Record<string, string>, keepUnresolved = false, escapeValues = false): string {
  // keepUnresolved: a ticket-scoped render leaves a code it has no real value
  // for as its raw {{CODE}} token, rather than blanking it or filling it with
  // generic sample data.
  // Inside a tag (a link or button href) the value is attribute-escaped. Pass escapeValues when the result is rendered as HTML (forms and printouts); leave it off for plain text such as an SMS.
  return html.replace(/(<[a-zA-Z][^<>]*>)|\{\{(\w+)\}\}/g, (match, tag: string | undefined, code: string) => {
    if (tag) return tag.replace(/\{\{(\w+)\}\}/g, (m, c: string) => (samples[c] !== undefined ? escapeAttr(samples[c]) : (keepUnresolved ? m : '')))
    const value = samples[code]
    if (value === undefined) return keepUnresolved ? match : ''
    return escapeValues ? escapeText(value) : value
  })
}

/**
 * Codes that are genuinely organization-wide constants (the Asset Team's own
 * contact details, the fixed declared shipping value) rather than anything
 * that varies by ticket - these never have a per-ticket source and were never
 * meant to, so the Placeholder Check below doesn't flag them as "missing
 * ticket data" the way it flags a real per-ticket field (courier, dates,
 * asset info) that this ticket happens not to have.
 */
export const ORG_CONSTANT_TOKENS = new Set([
  'ASSET_TEAM_NAME', 'ASSET_TEAM_ADDRESS', 'ASSET_TEAM_MOBILE', 'ASSET_TEAM_LANDLINE',
  'ASSET_TEAM_EMAIL', 'ASSET_TEAM_SCHEDULE', 'ASSET_TEAM_OFFICER', 'DECLARED_VALUE',
  // The corporate account is held in the company's own name.
  'COURIER_ACCOUNT_NAME'
])

/** Every distinct {{CODE}} appearing in `html`, in first-seen order. */
export function extractTokenCodes(html: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const m of html.matchAll(/\{\{(\w+)\}\}/g)) {
    if (!seen.has(m[1]!)) { seen.add(m[1]!); out.push(m[1]!) }
  }
  return out
}

export type PlaceholderStatus = 'resolved' | 'org-constant' | 'missing' | 'unrecognized'

export interface PlaceholderCheckEntry {
  code: string
  name: string
  status: PlaceholderStatus
  /** what would actually print in the real, sent document right now */
  previewValue: string
}

/**
 * The comparison behind the Placeholder Check feature: for every {{CODE}}
 * actually used in a piece of attached content, says whether this ticket has
 * a real value for it or whether it's "out of context" - either falling back
 * to generic sample text because the ticket has no data for it, or not a
 * recognized placeholder at all (a typo, or a token invented in the editor
 * that no real ticket field will ever fill), in which case it prints as
 * nothing in the actual sent document (see resolveTokensForPrint above).
 * `ticketResolvedCodes` are the codes this specific ticket supplied a real,
 * non-empty value for - see ticketSampleValues/ticketResolvedCodes in
 * ticket-tracker/[id].vue for how that set is built.
 */
/** The single source of truth behind both checkPlaceholders (the drawer) and the highlighted-preview coloring (wrapTokens' statusFor) - kept as one function so the two can never quietly disagree about what counts as resolved/missing/unrecognized for a given code. */
export function placeholderStatusFor(code: string, ticketResolvedCodes: Set<string>): PlaceholderStatus {
  if (!TOKEN_INFO[code]) return 'unrecognized'
  if (ORG_CONSTANT_TOKENS.has(code)) return 'org-constant'
  if (ticketResolvedCodes.has(code)) return 'resolved'
  return 'missing'
}

export function checkPlaceholders(
  html: string,
  ticketResolvedCodes: Set<string>,
  samples: Record<string, string>
): PlaceholderCheckEntry[] {
  return extractTokenCodes(html).map((code) => {
    const status = placeholderStatusFor(code, ticketResolvedCodes)
    const name = TOKEN_INFO[code] ?? code
    return { code, name, status, previewValue: status === 'unrecognized' ? '' : (samples[code] ?? `{{${code}}}`) }
  })
}


/**
 * A case where the equipment never came back has no receipt, so a "Date
 * received" line has nothing to say (and nothing to fill it from). Charging
 * content drops that line for such cases.
 */
export function omitReceivedDate(html: string): string {
  return html.replace(/Date received: \{\{DATE_RECEIVED\}\}(<br>|<\/p>)/g, (_m, tail) => tail === '</p>' ? '</p>' : '')
}

/** One asset on a ticket, as the retrieval emails and forms print it. */
export interface TicketAssetLine { name: string, tag: string, serial: string }

/**
 * Prints every confirmed asset of a ticket, one row per asset.
 *
 * Integrity rules, so a row can never show a tag that belongs to another
 * asset's name:
 * - A row is built from ONE asset record: name, tag and serial are read from
 *   the same object in the same pass. Separate lists are never zipped.
 * - A token never holds several values. Each row's token holds that row's
 *   own value, so the placeholder can still be located and highlighted.
 * - A row that carries {{ASSET_TAG}} or {{SERIAL_NUMBER}} is a per-asset row,
 *   and its {{ASSET_QTY}} is 1. A row with only {{ASSET_NAME}} and
 *   {{ASSET_QTY}} is the aggregated courier table: one row per distinct
 *   model, quantity counted from the very same list.
 * - {{ASSET_TABLE}} and {{ASSET_TABLE_QTY}} expand to those same two tables.
 * Charging content (its last column is {{ASSET_CONDITION}}) is left alone,
 * because that table lists the case's own items, see expandCaseAssetRows.
 *
 * \`wrap\` lets the on-screen preview emit its highlight span around each
 * filled value (the markup wrapTokens writes). Without it the value is plain
 * escaped text, which is what gets sent and printed.
 */
export function expandTicketAssets(
  html: string,
  assets: TicketAssetLine[],
  wrap?: (code: string, value: string) => string
): string {
  if (!assets.length || !html || html.includes('{{ASSET_CONDITION}}')) return html
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const put = (code: string, value: string) => wrap ? wrap(code, value) : esc(value)
  const grouped: { name: string, qty: number }[] = []
  for (const a of assets) {
    const g = grouped.find(x => x.name === a.name)
    if (g) g.qty++
    else grouped.push({ name: a.name, qty: 1 })
  }
  const fullTable = '<table><tr><th>Asset Name</th><th>Asset Tag</th><th>Serial Number</th></tr>'
    + assets.map(a => `<tr><td>${put('ASSET_NAME', a.name)}</td><td>${put('ASSET_TAG', a.tag)}</td><td>${put('SERIAL_NUMBER', a.serial)}</td></tr>`).join('') + '</table>'
  const qtyTable = '<table><tr><th>Asset Name</th><th>Qty</th></tr>'
    + grouped.map(g => `<tr><td>${put('ASSET_NAME', g.name)}</td><td>${put('ASSET_QTY', String(g.qty))}</td></tr>`).join('') + '</table>'
  const row = (tokens: string) => new RegExp(String.raw`<tr>(?:(?!</tr>)[\s\S])*?\{\{(?:${tokens})\}\}(?:(?!</tr>)[\s\S])*</tr>`, 'g')
  const fill = (rowHtml: string, values: Record<string, string>) =>
    rowHtml.replace(/\{\{(ASSET_NAME|ASSET_TAG|SERIAL_NUMBER|ASSET_QTY)\}\}/g, (m, code: string) => code in values ? put(code, values[code]!) : m)
  return html
    .replace(/\{\{ASSET_TABLE_QTY\}\}/g, qtyTable)
    .replace(/\{\{ASSET_TABLE\}\}/g, fullTable)
    // Per-asset rows: any row with a tag or serial. Its quantity is 1.
    .replace(row('ASSET_TAG|SERIAL_NUMBER'), rowHtml => assets.map(a =>
      fill(rowHtml, { ASSET_NAME: a.name, ASSET_TAG: a.tag, SERIAL_NUMBER: a.serial, ASSET_QTY: '1' })).join(''))
    // Aggregated rows: name and quantity only, one row per distinct model.
    .replace(row('ASSET_QTY|ASSET_NAME'), rowHtml => grouped.map(g =>
      fill(rowHtml, { ASSET_NAME: g.name, ASSET_QTY: String(g.qty) })).join(''))
}

/**
 * Post-Retrieval Charging prints one table row per asset in the case. Any
 * <tr> that carries an asset placeholder ({{ASSET_TAG}}, {{SERIAL_NUMBER}},
 * {{ASSET_NAME}}, {{ASSET_CONDITION}}) is repeated once per row in `rows`,
 * each copy filled with that asset's values. A value missing for a row
 * leaves its token in place, so the placeholder check still catches it.
 * Works on saved template/form content too - nothing in the stored HTML
 * has to change.
 */
export function expandCaseAssetRows(html: string, rows: Record<string, string>[]): string {
  if (!rows.length || !html) return html
  const esc = (v: string) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  return html.replace(/<tr>(?:(?!<\/tr>)[\s\S])*?\{\{(?:ASSET_TAG|SERIAL_NUMBER|ASSET_NAME|ASSET_CONDITION)\}\}(?:(?!<\/tr>)[\s\S])*<\/tr>/g, rowHtml =>
    rows.map(r => rowHtml.replace(/\{\{(ASSET_TAG|SERIAL_NUMBER|ASSET_NAME|ASSET_CONDITION)\}\}/g, (tok, code) => r[code] ? esc(r[code]) : tok)).join(''))
}
