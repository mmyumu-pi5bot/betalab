export const enTutorial = {

  // Nouns the tutorial slots into its own sentences
  "tutorial.item.extractionTube": "extraction tube",
  "tutorial.item.sampleVial": "sample vial",
  "tutorial.item.standardAtLevel": "{p0} ng/mL standard",
  "tutorial.item.autosamplerVial": "Autosampler vial",
  "tutorial.item.chilledTube": "chilled tube",
  "tutorial.item.calibrationStandardVial": "Calibration standard vial",
  "tutorial.item.cuttingBoard": "Cutting board",
  "tutorial.item.sampleBag": "sample bag",
  "tutorial.item.weighedTube": "weighed tube",
  "tutorial.item.mixedExtractionTube": "mixed extraction tube",
  "tutorial.item.separatedExtractionTube": "separated extraction tube",
  "tutorial.item.tube": "tube",
  "tutorial.tool.knife": "Stainless steel knife",
  "tutorial.tool.pipette": "Micropipette",
  "tutorial.tool.spatula": "Powder spatula",

  // Guided tutorial — steps, chapters and coaching text
  "tutorial.gettutorialcountdown.label":
    "Seal the tube and start the vortex",
  "tutorial.gettutorialactiontoolpresentation.title":
    "Put the {p0} away",
  "tutorial.gettutorialactiontoolpresentation.instruction":
    "The {p0} is still in hand, and drag and drop stays disabled while a tool is selected. Click the highlighted {p1} in Actions, or press {p2}, to put it away.",
  "tutorial.gettutorialactiontoolpresentation.hint":
    "As soon as no tool is selected, the tutorial highlights what to drag for this step.",
  "tutorial.gettutorialactiontoolpresentation.label":
    "Click it again or press {p0}",
  "tutorial.gettutorialactiontoolpickuppresentation.title":
    "Pick the {p0} back up",
  "tutorial.gettutorialactiontoolpickuppresentation.instruction":
    "The {p0} still holds what was left of the last pour, but it is not in hand. Click the highlighted {p1} in Actions, or press {p2}, to take it again.",
  "tutorial.gettutorialactiontoolpickuppresentation.hint":
    "Pouring stops when you release, so the {p0} keeps whatever it has left.",
  "tutorial.gettutorialactiontoolpickuppresentation.label":
    "Click it or press {p0}",
  "tutorial.gettutorialinventorycategorypresentation.title":
    "Open the {p0} section",
  "tutorial.gettutorialinventorycategorypresentation.instruction":
    "The item for this step is in the {p0} section of the Inventory, and that section is collapsed. Click the highlighted header to expand it.",
  "tutorial.gettutorialinventorycategorypresentation.hint":
    "The tutorial will highlight the item to use as soon as the section is open.",
  "tutorial.gettutorialinventorycategorypresentation.label":
    "Click the highlighted {p0} header",
  "tutorial.getmethodwalkpresentation.title":
    "Open the method editor",
  "tutorial.getmethodwalkpresentation.instruction":
    "Click the highlighted Edit tab to open the editor for this method.",
  "tutorial.getmethodwalkpresentation.hint":
    "The Details tab only shows the method; the concentration ladder is edited on Edit.",
  "tutorial.getmethodwalkpresentation.label":
    "Open Edit",
  "tutorial.getmethodwalkpresentation.title2":
    "Duplicate the method first",
  "tutorial.getmethodwalkpresentation.instruction2":
    "This is a built-in method and cannot be edited. Click the highlighted Duplicate method to obtain an editable copy, then edit the copy.",
  "tutorial.getmethodwalkpresentation.hint2":
    "The copy keeps every transition of the original — only its identity changes.",
  "tutorial.getmethodwalkpresentation.label2":
    "Duplicate method",
  "tutorial.getmethodwalkpresentation.title3":
    "Save the method",
  "tutorial.getmethodwalkpresentation.instruction3":
    "Click the highlighted Save as new version to store the copy with its calibration ladder.",
  "tutorial.getmethodwalkpresentation.hint3":
    "Nothing is written until you save: leaving the editor now would lose the level you typed.",
  "tutorial.getmethodwalkpresentation.label3":
    "Save as new version",
  "tutorial.getmethodwalkpresentation.title4":
    "Close the method manager",
  "tutorial.getmethodwalkpresentation.instruction4":
    "The method is saved. Close the highlighted method manager to get back to the acquisition console.",
  "tutorial.getmethodwalkpresentation.hint4":
    "The console still has to be pointed at the copy — the manager does not switch it for you.",
  "tutorial.getmethodwalkpresentation.label4":
    "Close the manager",
  "tutorial.getmethodwalkpresentation.title5":
    "Launch the acquisition",
  "tutorial.getmethodwalkpresentation.instruction5":
    "The method is saved and the console is already pointed at it — duplicating switched the selection for you. Click Launch acquisition to record the sequence.",
  "tutorial.getmethodwalkpresentation.hint5":
    "The declared ladder only reaches the method file through a run: the step confirms itself once the sequence starts.",
  "tutorial.getmethodwalkpresentation.label5":
    "Launch acquisition",
  "tutorial.getmethodwalkpresentation.title6":
    "Type the calibration levels",
  "tutorial.getmethodwalkpresentation.instruction6":
    "Click the highlighted Calibration levels field and enter exactly: {p0}. Then click Save as new version, and select the copy as the acquisition method.",
  "tutorial.getmethodwalkpresentation.label6":
    "Type {p0}",
  "tutorial.getmethodwalkpresentation.hint6":
    "Your standards were prepared at {p0} ng/mL. The tutorial checks the two against each other: what you type here is what the exported method file will claim was in the vials.",
  "tutorial.getmethodwalkpresentation.title7":
    "Those are not the levels you prepared",
  "tutorial.getmethodwalkpresentation.instruction7":
    "The Calibration levels field does not match the standards in your rack. Retype it as exactly: {p0}.",
  "tutorial.getmethodwalkpresentation.hint7":
    "A declared ladder that disagrees with the vials rescales every concentration computed against the curve, and nothing downstream can detect it: the run looks clean and reports wrong numbers. Your standards are at {p0} ng/mL.",
  "tutorial.getmethodwalkpresentation.label7":
    "Correct the levels to {p0}",
  "tutorial.getmethodwalkpresentation.title8":
    "The selected method declares the wrong levels",
  "tutorial.getmethodwalkpresentation.instruction8":
    "The method the console points at does not declare {p0} ng/mL. Click Manage methods and correct its Calibration levels before launching.",
  "tutorial.getmethodwalkpresentation.hint8":
    "The levels travel to the method file with the run, so they have to be right before the sequence starts, not after.",
  "tutorial.getmethodwalkpresentation.label8":
    "Open Manage methods",
  "tutorial.getlimstutorialfieldpresentation.title":
    "Review the reception weighing",
  "tutorial.getlimstutorialfieldpresentation.instruction":
    "Click the highlighted mass summary and review the calculation: {p0} g − {p1} g = {p2} g. The balance measured the sealed bag; subtracting the known bag tare gives the actual mass received.",
  "tutorial.getlimstutorialfieldpresentation.hint":
    "The declared mass on the field label is {p0} g. It is a reference value and may differ slightly from the measured net mass of {p1} g.",
  "tutorial.getlimstutorialfieldpresentation.label":
    "Review the mass calculation",
  "tutorial.getlimstutorialfieldpresentation.title2":
    "Enter the orchard / producer",
  "tutorial.getlimstutorialfieldpresentation.instruction2":
    "Click the highlighted field and enter exactly: {p0}. This value comes from the field label on the sample bag.",
  "tutorial.getlimstutorialfieldpresentation.hint2":
    "The Gross balance currently reads {p0} g. Keep the bag on it while completing the LIMS record.",
  "tutorial.getlimstutorialfieldpresentation.label2":
    "Type {p0}",
  "tutorial.getlimstutorialfieldpresentation.title3":
    "Enter the harvest date",
  "tutorial.getlimstutorialfieldpresentation.instruction3":
    "Click the highlighted date field and enter {p0}, as printed on the sample bag label.",
  "tutorial.getlimstutorialfieldpresentation.hint3":
    "Use the field-label date, not today's date or the experiment creation date.",
  "tutorial.getlimstutorialfieldpresentation.label3":
    "Enter {p0}",
  "tutorial.getlimstutorialfieldpresentation.title4":
    "Enter the declared mass",
  "tutorial.getlimstutorialfieldpresentation.instruction4":
    "Click the highlighted field and enter {p0} g. This is the approximate net mass declared on the bag label.",
  "tutorial.getlimstutorialfieldpresentation.hint4":
    "Do not copy the {p0} g gross reading or the {p1} g calculated net mass here. This field preserves what the sender declared.",
  "tutorial.getlimstutorialfieldpresentation.label4":
    "Type {p0}",
  "tutorial.getlimstutorialfieldpresentation.title5":
    "Create the LIMS record",
  "tutorial.getlimstutorialfieldpresentation.instruction5":
    "Leave Sample mass empty for now, then click the highlighted Create LIMS record button.",
  "tutorial.getlimstutorialfieldpresentation.hint5":
    "The LIMS keeps the {p0} g measured gross mass, the {p1} g bag tare, and the {p2} g calculated received net mass. Sample mass will be measured later on the Analytical balance.",
  "tutorial.getlimstutorialfieldpresentation.label5":
    "Click Create LIMS record",
  "tutorial.registersamplepresentation.title":
    "Deploy the LIMS terminal",
  "tutorial.registersamplepresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the highlighted LIMS terminal and drop it onto the central workspace.",
  "tutorial.registersamplepresentation.label":
    "Drag to workspace",
  "tutorial.registersamplepresentation.title2":
    "Return the sample bag to the Gross balance",
  "tutorial.registersamplepresentation.hint":
    "Keep the bag on the balance until the LIMS record is complete and its printed label has been applied.",
  "tutorial.registersamplepresentation.label2":
    "Drag onto the balance",
  "tutorial.registersamplepresentation.title3":
    "Create the LIMS record",
  "tutorial.registersamplepresentation.instruction2":
    "Review the reception mass calculation. Then enter Orchard / producer: {p0}. Enter Harvest date: {p1}. Enter Declared mass from bag label: {p2} g. Leave Sample mass empty for now. Then click Create LIMS record.",
  "tutorial.registersamplepresentation.hint2":
    "The LIMS automatically keeps the {p0} g gross reading and calculates {p1} g after subtracting the {p2} g bag tare.",
  "tutorial.registersamplepresentation.label3":
    "Enter the values, then click",
  "tutorial.registersamplepresentation.title4":
    "Print the LIMS label",
  "tutorial.registersamplepresentation.instruction3":
    "In the LIMS terminal, click Print label.",
  "tutorial.registersamplepresentation.hint3":
    "The printed label will appear in the LIMS terminal and can then be dragged.",
  "tutorial.registersamplepresentation.label4":
    "Click Print label",
  "tutorial.registersamplepresentation.title5":
    "Apply the LIMS label",
  "tutorial.registersamplepresentation.instruction4":
    "Drag the printed LIMS label from the terminal and drop it directly onto the sample bag on the Gross balance.",
  "tutorial.registersamplepresentation.hint4":
    "Once the label is attached, you can move the bag away and store the balance.",
  "tutorial.registersamplepresentation.label5":
    "Drag label onto bag",
  "tutorial.extractionequipmentpresentation.title":
    "Deploy the {p0}",
  "tutorial.extractionequipmentpresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the highlighted {p0} and drop it onto the central workspace.",
  "tutorial.extractionequipmentpresentation.title2":
    "Return the extraction tube to the {p0}",
  "tutorial.extractionequipmentpresentation.instruction2":
    "Locate the extraction tube at the highlighted location, then drag it and drop it into the {p0}.",
  "tutorial.extractionequipmentpresentation.hint":
    "Moving a required item away does not reset progress; the tutorial will keep pointing to its current location.",
  "tutorial.extractionequipmentpresentation.instruction3":
    "Watch the highlighted progress bar. Leave the extraction tube inside until it reaches 100%.",
  "tutorial.extractionequipmentpresentation.label":
    "Wait for 100%",
  "tutorial.extractionequipmentpresentation.label2":
    "Click Start vortex",
  "tutorial.extractionequipmentpresentation.label3":
    "Click Close",
  "tutorial.extractionequipmentpresentation.title3":
    "Start the centrifuge cycle",
  "tutorial.extractionequipmentpresentation.instruction4":
    "Click the highlighted Start the centrifuge button.",
  "tutorial.extractionequipmentpresentation.label4":
    "Click Start centrifuge",
  "tutorial.samplevialpresentation.title":
    "Take the tube out of the centrifuge",
  "tutorial.samplevialpresentation.instruction":
    "Drag the separated extraction tube out of the Centrifuge and drop it onto an empty workbench station. Pipetting is done at the bench, not inside the instrument.",
  "tutorial.samplevialpresentation.hint":
    "The separated phases stay in place as long as the tube is moved gently.",
  "tutorial.samplevialpresentation.label":
    "Drag the tube to the bench",
  "tutorial.samplevialpresentation.title2":
    "Open the extraction tube",
  "tutorial.samplevialpresentation.instruction2":
    "Click the highlighted Open button on the extraction tube. The micropipette cannot aspirate through a sealed cap.",
  "tutorial.samplevialpresentation.hint2":
    "Only the supernatant is drawn; the settled pellet stays at the bottom of the tube.",
  "tutorial.samplevialpresentation.label2":
    "Click Open",
  "tutorial.samplevialpresentation.title3":
    "Draw more extract before dispensing",
  "tutorial.samplevialpresentation.instruction3":
    "The micropipette holds {p0} mL, which would leave the vial too shallow for the autosampler needle to reach. Press and hold on the extraction tube again until the pipette reads about 1.00 mL.",
  "tutorial.samplevialpresentation.hint3":
    "A quick click commits a single 0.05 mL step. Keep the button held down and watch the volume climb.",
  "tutorial.samplevialpresentation.label3":
    "Hold on the tube to draw more",
  "tutorial.samplevialpresentation.instruction4":
    "The micropipette now contains extract. Press and hold on the highlighted Autosampler vial to dispense it, and release once the pipette is empty.",
  "tutorial.samplevialpresentation.hint4":
    "The micropipette icon shows how much liquid is currently loaded.",
  "tutorial.samplevialpresentation.label4":
    "Hold on the vial to dispense",
  "tutorial.samplevialpresentation.hint5":
    "A quick click only draws 0.05 mL — hold until the volume gets there. How much you take does not change the measured concentration, but it must be enough to inject.",
  "tutorial.samplevialpresentation.label5":
    "Hold on the tube to draw 1.00 mL",
  "tutorial.samplevialpresentation.label6":
    "Click pipette or press P",
  "tutorial.samplevialpresentation.title4":
    "Deploy an Autosampler vial",
  "tutorial.samplevialpresentation.instruction5":
    "In Inventory, open Containers. Drag an Autosampler vial and drop it onto an empty workbench station.",
  "tutorial.samplevialpresentation.hint6":
    "After placing the vial, use the Micropipette to transfer the separated extract into it.",
  "tutorial.stagevialspresentation.title":
    "Deploy the Autosampler rack",
  "tutorial.stagevialspresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the Autosampler rack and drop it onto the central workspace.",
  "tutorial.stagevialspresentation.title2":
    "Return the {p0} to the rack",
  "tutorial.stagevialspresentation.instruction2":
    "Drag the highlighted {p0} and drop it into an empty rack position.",
  "tutorial.stagevialspresentation.title3":
    "Seal and stage the {p0}",
  "tutorial.stagevialspresentation.instruction3":
    "At the highlighted location, click Close on the {p0}. Then drag it into an empty rack position.",
  "tutorial.stagevialspresentation.title4":
    "Check both staged vials",
  "tutorial.stagevialspresentation.instruction4":
    "Make sure both rack vials are sealed. Close any vial that is still open.",
  "tutorial.weighreceptionpresentation.title":
    "Deploy the Gross balance",
  "tutorial.weighreceptionpresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the highlighted Gross balance and drop it onto the central workspace.",
  "tutorial.weighreceptionpresentation.label":
    "Drag to workspace",
  "tutorial.weighreceptionpresentation.title2":
    "Place the sample bag on the Gross balance",
  "tutorial.weighreceptionpresentation.instruction2":
    "Locate the highlighted sample bag, then drag it and drop it onto the Gross balance.",
  "tutorial.weighreceptionpresentation.label2":
    "Drag bag onto balance",
  "tutorial.weighreceptionpresentation.title3":
    "Wait for the gross mass",
  "tutorial.weighreceptionpresentation.instruction3":
    "Leave the bag on the Gross balance while its mass is recorded.",
  "tutorial.weighreceptionpresentation.label3":
    "Wait for the mass",
  "tutorial.grindsamplepresentation.title":
    "Deploy the Cryogenic grinder",
  "tutorial.grindsamplepresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the Cryogenic grinder and drop it onto the central workspace.",
  "tutorial.grindsamplepresentation.label":
    "Drag to workspace",
  "tutorial.grindsamplepresentation.title2":
    "Load the cut apples into the grinder",
  "tutorial.grindsamplepresentation.instruction2":
    "Drag the cut apples from the highlighted location and drop them into the Cryogenic grinder.",
  "tutorial.grindsamplepresentation.label2":
    "Drag apples into grinder",
  "tutorial.grindsamplepresentation.title3":
    "Add Dry ice pellets",
  "tutorial.grindsamplepresentation.instruction3":
    "In Inventory, open Reagents & materials. Drag Dry ice pellets into the Cryogenic grinder. In the dosing dialog, enter {p0} g—roughly the mass of the apples—then confirm.",
  "tutorial.grindsamplepresentation.hint":
    "Using a 1:1 dry-ice-to-apple mass ratio cools the lot gradually. Do not start the grinder while the temperature is above −{p0} °C — a warmer start grinds the apples granular instead of fine.",
  "tutorial.grindsamplepresentation.label3":
    "Add {p0} g dry ice",
  "tutorial.grindsamplepresentation.title4":
    "Wait for grinding to finish",
  "tutorial.grindsamplepresentation.instruction4":
    "Watch the highlighted progress bar. Do not remove the apples while the grinder is running.",
  "tutorial.grindsamplepresentation.hint2":
    "The tutorial will continue automatically when the material becomes ground.",
  "tutorial.grindsamplepresentation.label4":
    "Wait for 100%",
  "tutorial.grindsamplepresentation.title5":
    "Wait for the apples to become cryogenic",
  "tutorial.grindsamplepresentation.instruction5":
    "Watch the highlighted thermometer. Wait until it reads −{p0} °C or colder before starting the grinder.",
  "tutorial.grindsamplepresentation.hint3":
    "The temperature falls over simulation ticks after the dry ice is added. Grinding a warmer lot leaves it granular, and a granular lot makes the weighed test portion unrepresentative.",
  "tutorial.grindsamplepresentation.label5":
    "Wait until −{p0} °C",
  "tutorial.grindsamplepresentation.title6":
    "Start the grinder cycle",
  "tutorial.grindsamplepresentation.instruction6":
    "The apples are cold enough. Click the highlighted red power button on the grinder.",
  "tutorial.grindsamplepresentation.hint4":
    "After clicking, watch the progress indicator and leave the contents inside the grinder.",
  "tutorial.grindsamplepresentation.label6":
    "Click power",
  "tutorial.spentextractiontubepresentation.label":
    "Discard the tube",
  "tutorial.spentextractiontubepresentation.title":
    "The extraction tube is lost",
  "tutorial.spentextractiontubepresentation.instruction":
    "This tube was vortexed before being sealed, so its contents sprayed out and its walls are contaminated. Nothing can be extracted from it now. Discard it in the trash, then weigh a fresh test portion.",
  "tutorial.spentextractiontubepresentation.title2":
    "The extraction tube is lost",
  "tutorial.spentextractiontubepresentation.instruction2":
    "This tube was vortexed before the QuEChERS salts were added, so the sample bound to its walls instead of partitioning into the solvent. Discard it in the trash, then weigh a fresh test portion.",
  "tutorial.spentextractiontubepresentation.title3":
    "The QuEChERS salts set hard",
  "tutorial.spentextractiontubepresentation.instruction3":
    "The QuEChERS salts were already sitting in this dry tube when the solvent arrived, so they caked on contact instead of dissolving with the sample. Add the solvent first and the salts last. Discard this tube in the trash, then weigh a fresh test portion.",
  "tutorial.spentextractiontubepresentation.title4":
    "The QuEChERS salts set hard",
  "tutorial.spentextractiontubepresentation.instruction4":
    "Adding the QuEChERS salts starts an exothermic reaction, and the tube has to be sealed and vortexed within 15 seconds. Past that the salts cake solid around the sample and no extract can be recovered. Discard this tube in the trash, then weigh a fresh test portion — and this time deploy the Vortex mixer before adding the salts.",
  "tutorial.analyticalweighingpresentation.title":
    "Deploy the Analytical balance",
  "tutorial.analyticalweighingpresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the Analytical balance and drop it onto the central workspace.",
  "tutorial.analyticalweighingpresentation.title2":
    "Replace the compromised tube",
  "tutorial.analyticalweighingpresentation.instruction2":
    "This tube was tared after powder had already been added, so its Net reading can no longer teach the weighing correctly. Discard it, then deploy a fresh 50 mL tube from Inventory.",
  "tutorial.analyticalweighingpresentation.hint":
    "The tutorial will ignore this compromised tube after it reaches the trash and point to a replacement.",
  "tutorial.analyticalweighingpresentation.label":
    "Discard this tube",
  "tutorial.analyticalweighingpresentation.title3":
    "Return the tube to the Analytical balance",
  "tutorial.analyticalweighingpresentation.instruction3":
    "Drag the highlighted 50 mL tube and drop it onto the Analytical balance.",
  "tutorial.analyticalweighingpresentation.instruction4":
    "The replacement tube is empty. Click Tare now so Net returns to 0.000 g before adding any powder.",
  "tutorial.analyticalweighingpresentation.label2":
    "Click Tare",
  "tutorial.analyticalweighingpresentation.title4":
    "Add the test portion",
  "tutorial.analyticalweighingpresentation.label3":
    "Hold to dose about 10.000 g",
  "tutorial.analyticalweighingpresentation.label4":
    "Click spatula or press S",
  "tutorial.extractionpreparationpresentation.title":
    "Add the ISTD solution",
  "tutorial.extractionpreparationpresentation.instruction":
    "Drag the highlighted ISTD solution onto the extraction tube. Keep 0.05 mL in the dialog, then click Add.",
  "tutorial.extractionpreparationpresentation.label":
    "Add 0.05 mL ISTD",
  "tutorial.extractionpreparationpresentation.title2":
    "Add the extraction solvent",
  "tutorial.extractionpreparationpresentation.instruction2":
    "Drag the highlighted Acetonitrile onto the same tube. Enter 10 mL in the dialog, then click Add.",
  "tutorial.extractionpreparationpresentation.label2":
    "Add 10 mL acetonitrile",
  "tutorial.extractionpreparationpresentation.title3":
    "Deploy the Vortex mixer before the salts",
  "tutorial.extractionpreparationpresentation.instruction3":
    "The salts come last, and they start an exothermic reaction the moment they touch the solvent: from then on you have 15 seconds to seal the tube and start the mixer. Deploy the Vortex mixer now so it is waiting. In Inventory, open Workspace equipment, then drag it onto the central workspace.",
  "tutorial.extractionpreparationpresentation.hint":
    "Miss that window and the salts cake solid, taking the extraction with them.",
  "tutorial.extractionpreparationpresentation.deadline":
    "15 seconds to vortex once the salts are in",
  "tutorial.extractionpreparationpresentation.label3":
    "Drag to workspace",
  "tutorial.chillextractionpresentation.title":
    "Wait for the tube to come down",
  "tutorial.chillextractionpresentation.instruction":
    "Watch the temperature on the tube standing in the ice bath. Leave it there until it reads under {p0} °C.",
  "tutorial.chillextractionpresentation.hint":
    "Nothing is degrading yet. The cold is being banked against the heat the salts are about to release.",
  "tutorial.chillextractionpresentation.label":
    "Wait for under {p0} °C",
  "tutorial.chillextractionpresentation.title2":
    "Deploy the ice bath before the salts",
  "tutorial.chillextractionpresentation.instruction2":
    "The salts release the same exotherm whatever the tube starts at, so the only way to keep the peak low is to start low. In Inventory, open MISC, then drag the Ice bath onto the central workspace.",
  "tutorial.chillextractionpresentation.hint2":
    "Above 30 °C the residues start breaking down, and they do not all break down at the same rate. The internal standard does not degrade at all, so the ratio cannot correct any of it.",
  "tutorial.chillextractionpresentation.label2":
    "Drag to workspace",
  "tutorial.chillextractionpresentation.title3":
    "Chill the tube in the ice bath",
  "tutorial.chillextractionpresentation.instruction3":
    "Drag the extraction tube into the ice bath and leave it there until it reads under {p0} °C.",
  "tutorial.chillextractionpresentation.hint3":
    "Salted from room temperature the tube peaks near 45 °C and loses residues even on a perfect run to the mixer.",
  "tutorial.chillextractionpresentation.label3":
    "Drag the tube into the ice bath",
  "tutorial.saltextractionpresentation.title":
    "Take the chilled tube back out",
  "tutorial.saltextractionpresentation.instruction":
    "Drag the tube out of the ice bath and drop it onto an empty workbench station. The salts cannot be poured in while the tube is standing in the ice.",
  "tutorial.saltextractionpresentation.hint":
    "Out of the ice the tube climbs back slowly, so there is time to aim — the rush starts when the salts go in.",
  "tutorial.saltextractionpresentation.label":
    "Drag the tube out of the ice bath",
  "tutorial.saltextractionpresentation.title2":
    "Add the QuEChERS salts",
  "tutorial.saltextractionpresentation.instruction2":
    "Drag the highlighted QuEChERS salts packet onto the extraction tube and confirm the addition. The countdown starts on confirmation: you then have 15 seconds to seal the tube, drop it into the Vortex mixer and start the cycle.",
  "tutorial.saltextractionpresentation.hint2":
    "Know where you are going before you confirm: seal the tube, drag it into the mixer, click Start vortex.",
  "tutorial.saltextractionpresentation.deadline":
    "15 seconds start the moment you confirm",
  "tutorial.saltextractionpresentation.label2":
    "Add the salts packet",
  "tutorial.labelsamplevialpresentation.title":
    "Bring the LIMS terminal back",
  "tutorial.labelsamplevialpresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the highlighted LIMS terminal and drop it onto the central workspace.",
  "tutorial.labelsamplevialpresentation.hint":
    "The reception record is still there; you only need the terminal to print from it again.",
  "tutorial.labelsamplevialpresentation.label":
    "Drag to workspace",
  "tutorial.labelsamplevialpresentation.title2":
    "Print a second label",
  "tutorial.labelsamplevialpresentation.instruction2":
    "Click Print label in the LIMS terminal to print the reception label again.",
  "tutorial.labelsamplevialpresentation.hint2":
    "It is the same sample code as the bag: one reception, one identity, however many containers it passes through.",
  "tutorial.labelsamplevialpresentation.label2":
    "Click Print label",
  "tutorial.labelsamplevialpresentation.title3":
    "Stick the label on the sample vial",
  "tutorial.labelsamplevialpresentation.instruction3":
    "Drag the printed LIMS label and drop it onto the sample vial.",
  "tutorial.labelsamplevialpresentation.hint3":
    "The instrument reads the rack position by position, so the vial has to say what it holds. Without the label the console line comes up empty and you type the name by hand.",
  "tutorial.labelsamplevialpresentation.label3":
    "Drop onto the vial",
  "tutorial.calibrationvialpresentation.title":
    "Spike the {p0} ng/mL standard with the ISTD",
  "tutorial.calibrationvialpresentation.instruction":
    "Drag the highlighted ISTD solution onto the {p1} ng/mL vial. Replace the suggested volume with {p0} mL, then click Add.",
  "tutorial.calibrationvialpresentation.hint":
    "Every level gets the same ISTD dose — that is what makes the ratio comparable across the curve. The standard needs the same ISTD concentration as the sample, not the same volume: the tube took 0.05 mL into 10 mL of solvent, and this vial holds 1 mL. Ten times too much here would bias every ratio by ten.",
  "tutorial.calibrationvialpresentation.label":
    "Add {p0} mL ISTD",
  "tutorial.calibrationvialpresentation.title2":
    "Take calibration point {p0} of {p1} off the shelf",
  "tutorial.calibrationvialpresentation.instruction2":
    "In Inventory, open Containers. Drag the highlighted Calibration standard vial onto an empty workbench station, set the level to {p0} ng/mL, then click Take vial.",
  "tutorial.calibrationvialpresentation.hint2":
    "Nobody dilutes a standard at the bench on the morning of a batch: the levels are prepared, dispensed and labelled in advance. The label already says which level is in the vial — take the {p0} ng/mL one.",
  "tutorial.calibrationvialpresentation.title3":
    "The calibration standard is ready",
  "tutorial.calibrationvialpresentation.instruction3":
    "The {p0} ng/mL standard is prepared and spiked. Cap it and move on to staging the rack.",
  "tutorial.calibrationvialpresentation.hint3":
    "A single point sets the response per ng/mL and nothing else: the curve is forced through the origin, and a sample above the point is outside the calibrated range with no curve to extrapolate. Expect that — a lot can carry three times this level, and a dilution is the answer. Build the full series in free mode.",
  "tutorial.calibrationvialpresentation.label2":
    "Take a {p0} ng/mL vial",
  "tutorial.calibrationvialpresentation.title4":
    "Take the {p0} ng/mL standard off the shelf",
  "tutorial.addworkbenchstationpresentation.title":
    "Add a workbench station",
  "tutorial.addworkbenchstationpresentation.instruction":
    "There is no empty station for the {p0}. Click the highlighted + button in the Workbench header to add one.",
  "tutorial.addworkbenchstationpresentation.hint":
    "Once the new station appears, the tutorial points back to the item to place.",
  "tutorial.addworkbenchstationpresentation.label":
    "Click +",
  "tutorial.storegrinderpresentation.title":
    "Transfer the ground powder",
  "tutorial.storegrinderpresentation.instruction":
    "Drag the ground powder out of the grinder and drop it into the HDPE storage container. Then store the empty grinder.",
  "tutorial.storegrinderpresentation.title2":
    "Deploy an HDPE storage container",
  "tutorial.storegrinderpresentation.instruction2":
    "In Inventory, open Containers. Drag the Wide-neck HDPE jar and drop it onto an empty workbench station.",
  "tutorial.storegrinderpresentation.title3":
    "Store the empty grinder",
  "tutorial.storegrinderpresentation.instruction3":
    "Click Store in inventory in the Cryogenic grinder header.",
  "tutorial.storeequipmentpresentation.title":
    "Remove the {p0}",
  "tutorial.storeequipmentpresentation.instruction":
    "Drag the {p0} out of the {p1} and drop it onto an empty workbench station.",
  "tutorial.storeequipmentpresentation.hint":
    "The {p0} can only be stored after it is empty.",
  "tutorial.storeequipmentpresentation.label":
    "Drag out the {p0}",
  "tutorial.storeequipmentpresentation.title2":
    "Store the {p0}",
  "tutorial.storeequipmentpresentation.instruction2":
    "Click Store in inventory in the {p0} header.",
  "tutorial.storeequipmentpresentation.label2":
    "Click Store in inventory",
  "tutorial.infertutorialaction.label":
    "Wait and watch",
  "tutorial.infertutorialaction.label2":
    "Enter the requested values",
  "tutorial.infertutorialaction.label3":
    "Use the keyboard shortcut",
  "tutorial.infertutorialaction.label4":
    "Drag and drop",
  "tutorial.infertutorialaction.label5":
    "Click the highlighted control",
  "tutorial.infertutorialaction.label6":
    "Follow the highlighted area",
  "tutorial.declarecalibrationlevelspresentation.title":
    "Deploy the LC-MS/MS",
  "tutorial.declarecalibrationlevelspresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the LC-MS/MS and drop it onto the central workspace.",
  "tutorial.declarecalibrationlevelspresentation.title2":
    "Load the rack into the LC-MS/MS",
  "tutorial.declarecalibrationlevelspresentation.instruction2":
    "Drag the highlighted loaded rack and drop it into the LC-MS/MS.",
  "tutorial.declarecalibrationlevelspresentation.title3":
    "Declare the calibration levels in the method",
  "tutorial.declarecalibrationlevelspresentation.instruction3":
    "Open the acquisition console and click Manage methods. A built-in method cannot be edited, so duplicate it first, then type {p0} into Calibration levels and save the copy. Select that copy as the acquisition method.",
  "tutorial.declarecalibrationlevelspresentation.hint":
    "Nothing checks this against the vials. Whatever you type here is what the exported method file will claim was in the standards — declare {p0}, the levels you actually prepared, in that order. The file writes one Conc. column per level, and the platform reads them positionally.",
  "tutorial.declarecalibrationlevelspresentation.label":
    "Manage methods",
  "tutorial.launchsequencepresentation.title":
    "Deploy the LC-MS/MS",
  "tutorial.launchsequencepresentation.instruction":
    "In Inventory, open Workspace equipment. Drag the LC-MS/MS and drop it onto the central workspace.",
  "tutorial.launchsequencepresentation.title2":
    "Load the rack into the LC-MS/MS",
  "tutorial.launchsequencepresentation.instruction2":
    "Drag the highlighted loaded rack and drop it into the LC-MS/MS.",
  "tutorial.launchsequencepresentation.title3":
    "Launch the acquisition",
  "tutorial.launchsequencepresentation.instruction3":
    "Click Open acquisition console. Verify that one row is the calibration vial and one row is the sample vial, then click Launch acquisition.",
  "tutorial.launchsequencepresentation.label":
    "Open console, then launch",
  "tutorial.cleanupacquisitionpresentation.title":
    "Unload the rack",
  "tutorial.cleanupacquisitionpresentation.instruction":
    "In the LC-MS/MS, click Unload rack.",
  "tutorial.cleanupacquisitionpresentation.label":
    "Click Unload rack",
  "tutorial.cleanupacquisitionpresentation.title2":
    "Empty the Autosampler rack",
  "tutorial.cleanupacquisitionpresentation.instruction2":
    "Drag both vials out of the rack and place them on the workbench or in the trash.",
  "tutorial.cleanupacquisitionpresentation.title3":
    "Store the empty rack",
  "tutorial.cleanupacquisitionpresentation.instruction3":
    "Click Store in inventory in the Autosampler rack header.",
  "tutorial.cleanupacquisitionpresentation.title4":
    "Store the LC-MS/MS",
  "tutorial.cleanupacquisitionpresentation.instruction4":
    "Click Store in inventory in the LC-MS/MS header.",
  "tutorial.weigh-received-sample.title":
    "Weigh the received sample bag",
  "tutorial.weigh-received-sample.instruction":
    "In Inventory, open Workspace equipment. Drag the highlighted Gross balance and drop it onto the central workspace. Then open the Produce basket, drag the sample bag, and drop it onto the balance.",
  "tutorial.weigh-received-sample.hint":
    "Dropping the bag onto the balance automatically records its gross mass.",
  "tutorial.register-and-label-sample.title":
    "Register and identify the sample",
  "tutorial.register-and-label-sample.instruction":
    "Fill in the LIMS form, click Create LIMS record, and then click Print label.",
  "tutorial.register-and-label-sample.hint":
    "Drag the printed LIMS label and drop it directly onto the sample bag.",
  "tutorial.store-gross-balance.title":
    "Store the receiving balance",
  "tutorial.store-gross-balance.instruction":
    "Drag the sample bag off the balance and drop it onto an empty workbench station. Then click Store in inventory in the balance header.",
  "tutorial.store-gross-balance.hint":
    "The Store in inventory button becomes available once the weighing pan is empty.",
  "tutorial.store-gross-balance.title2":
    "Store the LIMS terminal",
  "tutorial.store-gross-balance.instruction2":
    "Click the highlighted Store in inventory button in the top-right corner of the LIMS terminal.",
  "tutorial.store-gross-balance.hint2":
    "The LIMS record and printed label stay saved after the terminal is stored.",
  "tutorial.store-gross-balance.label":
    "Click the top-right button",
  "tutorial.cut-sample.title":
    "Cut the apples",
  "tutorial.cut-sample.instruction":
    "Drag a Cutting board from Inventory and drop it onto an empty workbench station. Drag the apples from the sample bag onto the board, click Stainless steel knife in Actions, and then click the apples.",
  "tutorial.cut-sample.hint":
    "Clicking the apples while the knife is active changes their material state to cut.",
  "tutorial.cut-sample.title2":
    "Deploy a Cutting board",
  "tutorial.cut-sample.instruction2":
    "In Inventory, open MISC. Drag a Cutting board and drop it onto an empty workbench station.",
  "tutorial.cut-sample.label":
    "Drag board to workbench",
  "tutorial.cut-sample.title3":
    "Open the sample bag",
  "tutorial.cut-sample.instruction3":
    "Click the highlighted Open button on the sample bag. The apples cannot be dragged while the bag is sealed.",
  "tutorial.cut-sample.hint2":
    "After the bag opens, the tutorial will highlight the apples inside it.",
  "tutorial.cut-sample.label2":
    "Click Open",
  "tutorial.cut-sample.title4":
    "Place the apples on the Cutting board",
  "tutorial.cut-sample.instruction4":
    "Drag the highlighted apples themselves—not the bag—and drop them onto the Cutting board.",
  "tutorial.cut-sample.hint3":
    "The sample bag stays behind. Only the apple lot moves onto the preparation board.",
  "tutorial.cut-sample.label3":
    "Drag the apples",
  "tutorial.cut-sample.title5":
    "Select the Stainless steel knife",
  "tutorial.cut-sample.instruction5":
    "Click the highlighted knife in Actions, or press K on your keyboard. Then click the apples on the Cutting board to cut them.",
  "tutorial.cut-sample.hint4":
    "The knife button remains active until you click it again or select another action.",
  "tutorial.cut-sample.label4":
    "Click knife or press K",
  "tutorial.grind-sample.title":
    "Cryogenically homogenize the sample",
  "tutorial.grind-sample.instruction":
    "Drag the highlighted Cryogenic grinder from Inventory and drop it onto the central workspace. Then drag the cut apples and Dry ice pellets into the grinder and click Start grinder.",
  "tutorial.grind-sample.hint":
    "Wait for the cycle to finish and for the material state to become ground.",
  "tutorial.store-grinder.title":
    "Empty and store the grinder",
  "tutorial.store-grinder.instruction":
    "Drag an HDPE storage container from Inventory onto an empty workbench station. Transfer the ground powder into it, then click Store in inventory in the grinder header.",
  "tutorial.store-grinder.hint":
    "The grinder must be empty before Store in inventory becomes available.",
  "tutorial.weigh-test-portion.title":
    "Prepare the test portion",
  "tutorial.weigh-test-portion.instruction":
    "Drag the highlighted Analytical balance from Inventory and drop it onto the central workspace. Place a 50 mL tube on it, click Tare, then use the Powder spatula action to add approximately 10.000 g of powder.",
  "tutorial.weigh-test-portion.hint":
    "The total mass shown for the tube must reach at least 9.5 g.",
  "tutorial.store-analytical-balance.title":
    "Store the analytical balance",
  "tutorial.store-analytical-balance.instruction":
    "Drag the weighed tube off the analytical balance and drop it onto an empty workbench station. Then click Store in inventory in the balance header.",
  "tutorial.store-analytical-balance.hint":
    "The test portion remains in the tube; only the empty balance is stored.",
  "tutorial.prepare-extraction.title":
    "Prepare the QuEChERS extraction",
  "tutorial.prepare-extraction.instruction":
    "Drag the ISTD solution onto the tube and confirm the volume. Repeat with acetonitrile to add 10 mL. Then deploy the Vortex mixer onto the workspace so it is waiting.",
  "tutorial.prepare-extraction.hint":
    "Add the ISTD before the solvent to preserve the correct analytical provenance. The mixer is deployed now because the salts leave only 15 seconds to reach it.",
  "tutorial.chill-extraction.title":
    "Chill the tube before the salts",
  "tutorial.chill-extraction.instruction":
    "Deploy the Ice bath from the MISC section of the Inventory, then drag the extraction tube into it and leave it until it reads under 1 °C.",
  "tutorial.chill-extraction.hint":
    "The salts add the same rise whatever the tube starts at. From room temperature that lands near 45 °C, well above the 30 °C where residues start breaking down.",
  "tutorial.salt-extraction.title":
    "Add the QuEChERS salts",
  "tutorial.salt-extraction.instruction":
    "Drag the chilled tube out of the ice bath onto an empty workbench station, then drag the QuEChERS salt packet onto it and confirm.",
  "tutorial.salt-extraction.hint":
    "Confirming starts the 15 second countdown to cementation. Know where the mixer is before you click.",
  "tutorial.vortex-extract.title":
    "Vortex the extraction",
  "tutorial.vortex-extract.instruction":
    "Drag and drop the sealed extraction tube into the Vortex mixer waiting on the workspace, then click Start vortex. The salts are already reacting, so do it now.",
  "tutorial.vortex-extract.hint":
    "Wait until the vortex cycle is complete before removing the tube.",
  "tutorial.store-vortex.title":
    "Store the vortex mixer and the ice bath",
  "tutorial.store-vortex.instruction":
    "Drag the mixed tube out of the vortex mixer and drop it onto an empty workbench station. Then click Store in inventory in the mixer header, and again in the ice bath header.",
  "tutorial.store-vortex.hint":
    "The centrifuge takes over in the next step, and the cold no longer protects anything once the residues are in the solvent.",
  "tutorial.separate-extract.title":
    "Centrifuge the extract",
  "tutorial.separate-extract.instruction":
    "Drag the highlighted Centrifuge from Inventory and drop it onto the central workspace. Drag the vortexed tube into the centrifuge and click Start the centrifuge.",
  "tutorial.separate-extract.hint":
    "Wait for the cycle to finish and for the extract phase to become separated.",
  "tutorial.prepare-sample-vial.title":
    "Prepare the sample vial",
  "tutorial.prepare-sample-vial.instruction":
    "Drag an Autosampler vial from Inventory onto an empty workbench station. Select Micropipette in Actions, click the separated tube to aspirate, then click the vial to dispense.",
  "tutorial.prepare-sample-vial.hint":
    "The vial becomes a sample vial when it receives extract from the separated tube.",
  "tutorial.label-sample-vial.title":
    "Identify the sample vial",
  "tutorial.label-sample-vial.instruction":
    "Bring the LIMS terminal back onto the workspace, click Print label a second time, then drag the printed label onto the sample vial.",
  "tutorial.label-sample-vial.hint":
    "The vial leaves the bench for a rack of identical vials. The label is what still says which sample it holds — and what the instrument reads to name the file it writes.",
  "tutorial.store-centrifuge.title":
    "Store the centrifuge",
  "tutorial.store-centrifuge.instruction":
    "Drag the tube out of the centrifuge and drop it onto an empty workbench station. Then click Store in inventory in the centrifuge header.",
  "tutorial.store-centrifuge.hint":
    "The prepared sample vial retains the extract needed for the remaining steps.",
  "tutorial.prepare-calibration-vial.title":
    "Prepare the calibration standard",
  "tutorial.prepare-calibration-vial.instruction":
    "Take a Calibration standard vial from Containers — at {p1} ng/mL — and spike it with {p0} mL of ISTD solution.",
  "tutorial.prepare-calibration-vial.hint":
    "The vial arrives prepared and labelled by the standards lab, but uncapped and unspiked: the internal standard is still yours to add. A real batch runs several levels — a single point forces the curve through the origin — but each one is the same three gestures, so the tutorial does one and leaves the full series to free mode.",
  "tutorial.stage-vials.title":
    "Stage the whole batch for the sequence",
  "tutorial.stage-vials.instruction":
    "Drag the highlighted Autosampler rack from Inventory and drop it onto the central workspace. Seal the sample vial and the standard, then drag and drop each one into an empty rack position.",
  "tutorial.stage-vials.hint":
    "Two vials, two injections, in rack order. The physical provenance of each vial is what lets the system tell the sample from the calibration point — nothing is inferred from the position.",
  "tutorial.declare-calibration-levels.title":
    "Declare the calibration level in the method",
  "tutorial.declare-calibration-levels.instruction":
    "Drag the highlighted LC-MS/MS from Inventory and drop it onto the central workspace. Load the rack, open the console and click Manage methods. Duplicate the built-in method, type the level you prepared into Calibration levels, and save the copy.",
  "tutorial.declare-calibration-levels.hint":
    "The exported method file gets one concentration column per level declared here, and none at all if you declare nothing. This step confirms itself when the sequence starts.",
  "tutorial.launch-sequence.title":
    "Load and start the sequence",
  "tutorial.launch-sequence.instruction":
    "Drag the highlighted LC-MS/MS from Inventory and drop it onto the central workspace. Drag and drop the loaded rack into the instrument, open the console, check both rows, and click Launch acquisition.",
  "tutorial.launch-sequence.hint":
    "The sequence must contain one calibration injection and one sample injection.",
  "tutorial.review-results.title":
    "Review the results",
  "tutorial.review-results.instruction":
    "Wait for both injections to finish, then compare the calibration point and sample results.",
  "tutorial.review-results.hint":
    "You can follow the active injection directly on the instrument illustration.",
  "tutorial.review-results.title2":
    "Wait for both injections",
  "tutorial.review-results.instruction2":
    "Watch the highlighted instrument screen. Acquisition is {p0}% complete; wait until both the calibration and sample injections finish.",
  "tutorial.review-results.hint2":
    "Do not unload the rack during acquisition. Results open automatically as the injections complete.",
  "tutorial.review-results.label":
    "Wait — {p0}% complete",
  "tutorial.store-acquisition-equipment.title":
    "Clear the acquisition workspace",
  "tutorial.store-acquisition-equipment.instruction":
    "Click Unload rack from LC-MS/MS, drag both vials out of the rack, and place them on the workbench or in the trash. Then click Store in inventory for the empty rack and the LC-MS/MS.",
  "tutorial.store-acquisition-equipment.hint":
    "The results remain available after the equipment is stored.",
  "tutorial.definition.title":
    "1 calibration point + 1 sample",
  "tutorial.reception.title":
    "Sample reception",
  "tutorial.sample-preparation.title":
    "Sample preparation",
  "tutorial.extraction.title":
    "QuEChERS extraction",
  "tutorial.vials.title":
    "Vial preparation",
  "tutorial.acquisition.title":
    "Rack and acquisition",


  // More tutorial nouns
  "tutorial.item.storageJar": "storage jar",


  // Tutorial coach panel and interventions
  "coach.resume": "Resume tutorial",
  "coach.title": "Guided tutorial",
  "coach.chapterProgress": "{chapter} · {percent}%",
  "coach.pause": "Pause tutorial",
  "coach.pauseShort": "Pause",
  "coach.complete": "Tutorial complete",
  "coach.completeBody":
    "The calibration point and sample have been acquired. Switch this experiment to free mode to keep working without the coach, or restart the tutorial.",
  "coach.switchToFreeMode": "Switch to free mode",
  "coach.objectives": "{done}/{total} objectives",
  "coach.restart": "Restart",
  "coach.inventoryFallback": "Inventory",
  "coach.openBasket.title": "Open the Produce basket",
  "coach.openBasket.instruction":
    "Click the highlighted Produce basket to open it. The sample bag or apples will then appear inside.",
  "coach.openBasket.hint":
    "The tutorial will highlight the required item as soon as the container is open.",
  "coach.openBasket.label": "Click the highlighted basket",
  "coach.openTrash.title": "Open the Trash",
  "coach.openTrash.instruction":
    "Click the highlighted Trash to open it. The item to recover will then appear inside.",
  "coach.openTrash.label": "Click the highlighted trash",
  "tutorial.put-spatula-away.title": "Empty the spatula and put it away",
  "tutorial.put-spatula-away.instruction":
    "The spatula still holds the powder left over from dosing. Click the Trash to discard it, then put the spatula down by pressing S or clicking it again in Actions.",
  "tutorial.put-spatula-away.hint":
    "Leftover powder never goes back into the storage jar — returning it would contaminate the stock. A tool stays in hand until you put it down, and drag and drop is blocked meanwhile.",
  "tutorial.putspatulaawaypresentation.title": "Discard the leftover powder",
  "tutorial.putspatulaawaypresentation.instruction":
    "Click the highlighted Trash to empty the spatula, then put it down by pressing S or clicking it again in Actions.",
  "tutorial.putspatulaawaypresentation.hint":
    "Powder that has left the jar is waste: putting it back would contaminate the stock. The next steps are drags, and they stay blocked while the spatula is in hand.",
  "tutorial.putspatulaawaypresentation.label": "Click the Trash",
  "coach.dropDraft.amount.title": "Set the amount",
  "coach.dropDraft.amount.instruction":
    "The drop is staged, not done. Set the highlighted box to {p0}, then the tutorial will point at the {p1} button.",
  "coach.dropDraft.amount.hint":
    "Click into the box and type the value, or scroll over it to step through. Nothing leaves the container until the dialog is confirmed.",
  "coach.dropDraft.amount.label": "Enter {p0}",
  "coach.dropDraft.confirm.title": "Confirm the amount",
  "coach.dropDraft.confirm.instruction":
    "{p0} is the amount this step asks for. Click the highlighted {p1} button to send it.",
  "coach.dropDraft.confirm.hint":
    "The value is still editable: correct the box first if you meant another amount.",
  "coach.dropDraft.confirm.label": "Click {p0}",
  "guard.contamination.title": "Contamination prevented",
  "guard.contamination.instruction":
    "Do not place the apples directly on the workbench. Contact with the bare surface would irreversibly contaminate the sample. Drop them onto the highlighted Cutting board instead.",
  "guard.contamination.hintCancelled":
    "The attempted drop was cancelled: the apples are still in their original container.",
  "guard.contamination.hintDeploy":
    "First deploy a Cutting board from Inventory, then transfer the apples onto it.",
  "guard.contamination.actionLabel": "Use the highlighted Cutting board",
  "guard.contamination.continueLabel": "Continue tutorial",
  "guard.contamination.leaveLabel": "Leave tutorial and place anyway",
  "guard.tare.title": "Tare protected",
  "guard.tare.instruction":
    "The tube already contains powder. Taring again would hide that mass from the Net display, so the tutorial cancelled the action. Keep the tare measured with the empty tube and continue dosing until Net reaches about 10.000 g.",
  "guard.tare.hint":
    "Nothing changed on the balance: the original empty-tube tare and the current Net value were preserved.",
  "guard.tare.actionLabel": "Do not tare again",
  "guard.tare.continueLabel": "Keep the empty-tube tare",
  "guard.tare.leaveLabel": "Leave tutorial and tare anyway",

  // Branch-specific coaching text: titles and explanations the coach picks
  // between at run time, which the first localisation pass left inline.
  "tutorial.getlimstutorialvalues.orchardName": "Tutorial Orchard",
  "tutorial.getlimstutorialfieldpresentation.grossMassFallback": "the current",
  "tutorial.getlimstutorialfieldpresentation.netMassFallback": "the calculated",
  "tutorial.registersamplepresentation.grossMassFallback": "current",
  "tutorial.registersamplepresentation.netMassFallback": "the net mass",
  "tutorial.registersamplepresentation.hint5":
    "Keep the bag on the balance while you deploy and complete the LIMS terminal.",
  "tutorial.registersamplepresentation.hint6":
    "After deploying the terminal, return the sample bag to the Gross balance before entering the LIMS data.",
  "tutorial.registersamplepresentation.instruction5":
    "Open the Produce basket, then drag the sample bag and drop it onto the Gross balance.",
  "tutorial.registersamplepresentation.instruction6":
    "Open the Trash, then drag the sample bag and drop it onto the Gross balance.",
  "tutorial.registersamplepresentation.instruction7":
    "Drag the sample bag from its workbench station and drop it onto the Gross balance.",
  "tutorial.registersamplepresentation.instruction8":
    "Locate the sample bag, then drag it and drop it onto the Gross balance.",
  "tutorial.extractionequipmentpresentation.title4":
    "Wait for vortex mixing",
  "tutorial.extractionequipmentpresentation.title5":
    "Wait for phase separation",
  "tutorial.extractionequipmentpresentation.title6":
    "Start the vortex cycle",
  "tutorial.extractionequipmentpresentation.title7":
    "Seal the extraction tube",
  "tutorial.extractionequipmentpresentation.instruction5":
    "Click the highlighted Start vortex button.",
  "tutorial.extractionequipmentpresentation.instruction6":
    "Click the highlighted Close button on the extraction tube before starting the mixer.",
  "tutorial.samplevialpresentation.title5":
    "Add more extract to the vial",
  "tutorial.samplevialpresentation.title6":
    "Transfer extract into the Autosampler vial",
  "tutorial.samplevialpresentation.instruction6":
    "The vial holds too little to be injected: the autosampler needle cannot reach the last 0.05 mL, so the run would record a flat baseline. Select the Micropipette again, then press and hold on the extraction tube to draw about 1.00 mL, and dispense it into the same vial.",
  "tutorial.samplevialpresentation.instruction7":
    "Click Micropipette in Actions, or press P. Then press and hold on the separated extraction tube until the pipette reads about 1.00 mL, and release.",
  "tutorial.spentextractiontubepresentation.hint":
    "Only this tube is lost. The ground sample is still in the storage jar, so a new 10 g test portion is all it takes to start the extraction over.",
  "tutorial.analyticalweighingpresentation.title5":
    "Deploy a replacement 50 mL tube",
  "tutorial.analyticalweighingpresentation.title6":
    "Deploy a 50 mL tube",
  "tutorial.analyticalweighingpresentation.title7":
    "Tare the replacement tube",
  "tutorial.analyticalweighingpresentation.title8":
    "Tare the tube",
  "tutorial.analyticalweighingpresentation.instruction5":
    "In Inventory, open Containers. Drag a fresh 50 mL centrifuge tube and drop it onto the Analytical balance. Do not recover the compromised powdered tube from the trash.",
  "tutorial.analyticalweighingpresentation.instruction6":
    "In Inventory, open Containers. Drag a 50 mL centrifuge tube and drop it onto the Analytical balance.",
  "tutorial.analyticalweighingpresentation.instruction7":
    "The spatula contains powder. Click and hold the tube on the Analytical balance until Net reaches about 10.000 g; release before 10.2 g.",
  "tutorial.analyticalweighingpresentation.instruction8":
    "Click the highlighted Powder spatula in Actions, or press S. Then click the powder in the HDPE container to load it.",

} as const;
