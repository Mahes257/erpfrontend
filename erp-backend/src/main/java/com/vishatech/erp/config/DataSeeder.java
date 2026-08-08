package com.vishatech.erp.config;

import com.vishatech.erp.entity.Activity;
import com.vishatech.erp.entity.Customer;
import com.vishatech.erp.entity.HistoryEntry;
import com.vishatech.erp.entity.Lead;
import com.vishatech.erp.entity.LeadStage;
import com.vishatech.erp.entity.LeadStatus;
import com.vishatech.erp.entity.Note;
import com.vishatech.erp.entity.Product;
import com.vishatech.erp.entity.TimelineEntry;
import com.vishatech.erp.entity.User;
import com.vishatech.erp.entity.UserRole;
import com.vishatech.erp.repository.CustomerRepository;
import com.vishatech.erp.repository.LeadRepository;
import com.vishatech.erp.repository.ProductRepository;
import com.vishatech.erp.repository.UserRepository;
import java.math.BigDecimal;
import java.time.LocalDateTime;
import org.springframework.boot.CommandLineRunner;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.crypto.password.PasswordEncoder;

@Configuration
public class DataSeeder {

    private static final String DEFAULT_PASSWORD = "Admin@123";

    @Bean
    public CommandLineRunner seedData(UserRepository userRepository, LeadRepository leadRepository,
                                      PasswordEncoder passwordEncoder, ProductRepository productRepository,
                                      CustomerRepository customerRepository) {
        return args -> {
            if (userRepository.count() == 0) {
                seedUsers(userRepository, passwordEncoder);
            }
            if (leadRepository.count() == 0) {
                seedLeads(leadRepository);
            }
            if (productRepository.count() == 0) {
                seedProducts(productRepository);
            }
            if (customerRepository.count() == 0) {
                seedCustomers(customerRepository);
            }
        };
    }

    private void seedProducts(ProductRepository productRepository) {
        productRepository.save(product("MS Flat Bar 25x3 mm", "MSFB253", "7208", "kg", "58.50", "18"));
        productRepository.save(product("MS Flat Bar 40x6 mm", "MSFB406", "7208", "kg", "55.00", "18"));
        productRepository.save(product("GI Sheet 0.5 mm", "GIS005", "7210", "sheet", "780.00", "18"));
        productRepository.save(product("HR Coil 2.0 mm", "HRC20", "7208", "ton", "48500.00", "18"));
        productRepository.save(product("CR Coil 0.8 mm", "CRC08", "7209", "ton", "54500.00", "18"));
        productRepository.save(product("Mild Steel Angle 50x50x5", "MSA505", "7216", "kg", "62.00", "18"));
        productRepository.save(product("TMT Bar 12 mm", "TMT12", "7214", "kg", "64.00", "18"));
        productRepository.save(product("Stainless Steel Pipe 1 inch", "SSP1", "7306", "mtr", "320.00", "18"));
        productRepository.save(product("Aluminium Sheet 1.0 mm", "ALS10", "7606", "sheet", "1450.00", "18"));
        productRepository.save(product("Copper Wire 2.5 sq mm", "CUW25", "7408", "mtr", "95.00", "18"));
        productRepository.save(product("PVC Conduit Pipe 25 mm", "PVCP25", "3926", "mtr", "35.00", "18"));
        productRepository.save(product("Galvanised Wire 2 mm", "GIW2", "7217", "kg", "78.00", "18"));
    }

    private Product product(String name, String sku, String hsn, String unit, String rate, String gstRate) {
        Product product = new Product();
        product.setName(name);
        product.setSku(sku);
        product.setHsn(hsn);
        product.setUnit(unit);
        product.setRate(new BigDecimal(rate));
        product.setGstRate(new BigDecimal(gstRate));
        product.setDescription(name);
        return product;
    }

    private void seedCustomers(CustomerRepository customerRepository) {
        customerRepository.save(customer("Apex Industries", "CL-0001", "Anand Ramesh", "+91 9444123456",
                "anand@apexmfg.in", "33AADCA0001P1Z5", "AADCA0001P", "Plot 12, Ambattur Industrial Estate",
                "Chennai", "Tamil Nadu", "600058", "30 Days", "450000", "Kavya Krishnan"));
        customerRepository.save(customer("SK Logistics", "CL-0002", "Suresh Kumar", "+91 9840123456",
                "suresh@sklog.com", "29AADCS0002P1Z6", "AADCS0002P", "88, Whitefield Main Road",
                "Bengaluru", "Karnataka", "560066", "45 Days", "1200000", "Raghav Menon"));
        customerRepository.save(customer("TechVision Labs", "CL-0003", "Meena Nair", "+91 9790123456",
                "meena@techvision.in", "32AADCT0003P1Z7", "AADCT0003P", "Infopark Phase II, Kakkanad",
                "Cochin", "Kerala", "682042", "60 Days", "210000", "Divya Nair"));
        customerRepository.save(customer("Prakash Exports", "CL-0004", "Prem Prakash", "+91 9176123456",
                "prem@prakashexp.com", "33AADCP0004P1Z8", "AADCP0004P", "22, Vandalur Road",
                "Chennai", "Tamil Nadu", "600048", "Advance", "875000", "Arun Pillai"));
        customerRepository.save(customer("Subramani Pharma", "CL-0005", "Karthik Subramani", "+91 9086452317",
                "karthik@subpharma.in", "36AADCS0005P1Z9", "AADCS0005P", "Plot 4, IDA Jeedimetla",
                "Hyderabad", "Telangana", "500055", "COD", "2500000", "Sneha Iyer"));
        customerRepository.save(customer("Chandran Constructions", "CL-0006", "Revathi Chandran", "+91 9847012345",
                "revathi@chandranconst.co", "32AADCC0006P1Z1", "AADCC0006P", "MG Road, Ernakulam",
                "Kochi", "Kerala", "682016", "30 Days", "5400000", "Vikram Rao"));
    }

    private Customer customer(String businessName, String clientCode, String contactPerson, String phone,
                              String email, String gstin, String pan, String address, String city,
                              String state, String pin, String paymentTerms, String creditLimit,
                              String salesPerson) {
        Customer customer = new Customer();
        customer.setBusinessName(businessName);
        customer.setClientCode(clientCode);
        customer.setContactPerson(contactPerson);
        customer.setPhone(phone);
        customer.setEmail(email);
        customer.setGstin(gstin);
        customer.setPan(pan);
        customer.setBillingAddress(address);
        customer.setShippingAddress(address);
        customer.setBillingCity(city);
        customer.setShippingCity(city);
        customer.setBillingState(state);
        customer.setShippingState(state);
        customer.setBillingPin(pin);
        customer.setShippingPin(pin);
        customer.setCountry("India");
        customer.setPaymentTerms(paymentTerms);
        customer.setCreditLimit(new BigDecimal(creditLimit));
        customer.setSalesPerson(salesPerson);
        customer.setCategory("Corporate");
        customer.setStatus("Active");
        customer.setCreatedAt(LocalDateTime.now().minusDays(30));
        customer.setUpdatedAt(LocalDateTime.now().minusDays(30));
        return customer;
    }

    private void seedUsers(UserRepository userRepository, PasswordEncoder passwordEncoder) {
        String encoded = passwordEncoder.encode(DEFAULT_PASSWORD);
        userRepository.save(user("admin@vishaktech.com", "Admin User", UserRole.ADMIN, encoded));
        userRepository.save(user("kavya@vishaktech.com", "Kavya Krishnan", UserRole.USER, encoded));
        userRepository.save(user("raghav@vishaktech.com", "Raghav Menon", UserRole.USER, encoded));
        userRepository.save(user("divya@vishaktech.com", "Divya Nair", UserRole.USER, encoded));
        userRepository.save(user("arun@vishaktech.com", "Arun Pillai", UserRole.USER, encoded));
        userRepository.save(user("sneha@vishaktech.com", "Sneha Iyer", UserRole.USER, encoded));
        userRepository.save(user("vikram@vishaktech.com", "Vikram Rao", UserRole.USER, encoded));
        userRepository.save(user("priya@vishaktech.com", "Priya Menon", UserRole.USER, encoded));
    }

    private User user(String email, String fullName, UserRole role, String encodedPassword) {
        User user = new User();
        user.setEmail(email);
        user.setFullName(fullName);
        user.setRole(role);
        user.setPassword(encodedPassword);
        user.setEnabled(true);
        return user;
    }

    private void seedLeads(LeadRepository leadRepository) {
        leadRepository.save(buildLead("Anand Ramesh", "Apex Industries", "Procurement Head",
                "+91 9444123456", "anand@apexmfg.in", "450000", LeadStage.HOT, "Referral",
                "Admin User", LeadStatus.ACTIVE, "Chennai"));
        leadRepository.save(buildLead("Suresh Kumar", "SK Logistics", "Operations Director",
                "+91 9840123456", "suresh@sklog.com", "1200000", LeadStage.WARM, "Cold Call",
                "Kavya Krishnan", LeadStatus.ACTIVE, "Bengaluru"));
        leadRepository.save(buildLead("Meena Nair", "TechVision Labs", "CTO",
                "+91 9790123456", "meena@techvision.in", "210000", LeadStage.COLD, "LinkedIn",
                "Raghav Menon", LeadStatus.ACTIVE, "Cochin"));
        leadRepository.save(buildLead("Prem Prakash", "Prakash Exports", "Owner",
                "+91 9176123456", "prem@prakashexp.com", "875000", LeadStage.HOT, "Trade Show",
                "Divya Nair", LeadStatus.ACTIVE, "Chennai"));
        leadRepository.save(buildLead("Karthik Subramani", "Subramani Pharma", "Director",
                "+91 9086452317", "karthik@subpharma.in", "2500000", LeadStage.NEGOTIATION, "Email Campaign",
                "Sneha Iyer", LeadStatus.ACTIVE, "Hyderabad"));
        leadRepository.save(buildLead("Revathi Chandran", "Chandran Constructions", "CEO",
                "+91 9847012345", "revathi@chandranconst.co", "5400000", LeadStage.QUALIFIED, "Referral",
                "Vikram Rao", LeadStatus.ACTIVE, "Kochi"));
        leadRepository.save(buildLead("Rajesh Nambiar", "Nambiar Spices", "Owner",
                "+91 9680123456", "rajesh@nambiarspices.com", "130000", LeadStage.COLD, "Website",
                "Kavya Krishnan", LeadStatus.ARCHIVED, "Thrissur"));
        leadRepository.save(buildLead("Ramesh Iyer", "Iyer Foods", "Managing Director",
                "+91 9940123456", "ramesh@iyerfoods.in", "3100000", LeadStage.WON, "Trade Show",
                "Kavya Krishnan", LeadStatus.ACTIVE, "Coimbatore"));
    }

    private Lead buildLead(String name, String company, String title, String phone, String email,
                           String value, LeadStage stage, String source, String owner,
                           LeadStatus status, String city) {
        Lead lead = new Lead();
        lead.setName(name);
        lead.setCompany(company);
        lead.setTitle(title);
        lead.setPhone(phone);
        lead.setEmail(email);
        lead.setValue(new BigDecimal(value));
        lead.setStage(stage);
        lead.setSource(source);
        lead.setOwner(owner);
        lead.setStatus(status);
        lead.setCity(city);
        lead.setState("Tamil Nadu");
        lead.setCountry("India");
        lead.setCreatedAt(LocalDateTime.now().minusDays(10));
        lead.setWebsite("https://" + company.toLowerCase().replaceAll("[^a-z0-9]", "") + ".example.com");

        TimelineEntry created = new TimelineEntry();
        created.setType("created");
        created.setTitle("Lead created");
        created.setDetail("Lead '" + name + "' was added to the pipeline.");
        lead.addTimeline(created);

        TimelineEntry stageEntry = new TimelineEntry();
        stageEntry.setType("stage");
        stageEntry.setTitle("Stage set");
        stageEntry.setDetail("Stage set to '" + titleCase(stage.name()) + "'.");
        lead.addTimeline(stageEntry);

        Note note = new Note();
        note.setText("Initial conversation completed. Follow up after one week.");
        note.setAuthor(owner);
        lead.addNote(note);

        Activity activity = new Activity();
        activity.setType("call");
        activity.setTitle("Introductory call");
        activity.setDetail("Discussed requirements and budget range.");
        activity.setOwner(owner);
        lead.addActivity(activity);

        HistoryEntry history = new HistoryEntry();
        history.setField("Lead");
        history.setOldValue(null);
        history.setNewValue(name);
        history.setChangedBy(owner);
        lead.addHistory(history);

        if (status == LeadStatus.ARCHIVED) {
            lead.setArchivedAt(LocalDateTime.now().minusDays(2));
        }
        return lead;
    }

    private String titleCase(String value) {
        return value.substring(0, 1).toUpperCase() + value.substring(1).toLowerCase();
    }
}
